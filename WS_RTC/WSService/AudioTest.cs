using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Net;
using System.Net.WebSockets;

namespace WS.WSService
{
    /// <summary>
    /// WebSocket test audio server
    /// </summary>
    public class AudioTest
    {
        private const int SampleRate = 48000;
        private const int SampleSize = 4096;
        private const int SampleBytes = SampleSize * sizeof(float);
        private const int BufferSize = 20;

        private const string WSEndpoint = "http://192.168.100.110:5678/wsaudio/";

        /// <summary>
        /// Server instance
        /// </summary>
        public static AudioTest Instance { get; set; }

        private Task serverTask;
        private Task updaterTask;

        private bool running;

        private Dictionary<WebSocket, Queue<float[]>> clients;
        private float[] mixedChunk;

        /// <summary>
        /// Start WebSocket server
        /// </summary>
        public void Start()
        {
            if(!running)
            {
                running = true;

                var option = TaskCreationOptions.LongRunning;
                serverTask = Task.Factory.StartNew(new Func<Task>(StartServer), option);
                updaterTask = Task.Factory.StartNew(new Func<Task>(UpdateState), option);
            }
        }

        /// <summary>
        /// Stop server
        /// </summary>
        public void Stop()
        {
            running = false;
        }

        // Communicate with client
        private async Task CommunicateWithClient(WebSocket socket)
        {
            while(true)
            {
                var sample = await ReceiveData(socket);
                var audioChunk = new float[SampleSize];
                Buffer.BlockCopy(sample, 0, audioChunk, 0, SampleBytes);
                clients[socket].Enqueue(audioChunk);
            }
        }

        // Process new connected socket
        private async void ServeClient(WebSocket socket)
        {
            clients.Add(socket, new Queue<float[]>());

            try
            {
                await CommunicateWithClient(socket);
            }
            catch (WebSocketException)
            {
                // Client disconnected
            }

            clients.Remove(socket);
        }

        // Create and return buffer for new message
        private async Task<byte[]> ReceiveData(WebSocket s)
        {
            var buffer = new ArraySegment<byte>(new byte[SampleBytes]);
            await s.ReceiveAsync(buffer, CancellationToken.None);
            return buffer.Array;
        }

        // Send data bytes back to client
        private async Task SendData(WebSocket s, byte[] data)
        {
            var buffer = new ArraySegment<byte>(data);
            var ct = CancellationToken.None;
            await s.SendAsync(buffer, WebSocketMessageType.Binary, true, ct);
        }

        // Create server and wait for clients
        private async Task StartServer()
        {
            var listener = new HttpListener();
            listener.Prefixes.Add(WSEndpoint);
            listener.Start();

            while (running)
            {
                var ctx = listener.GetContext();
                if (ctx.Request.IsWebSocketRequest)
                {
                    var wsCtx = await ctx.AcceptWebSocketAsync(null);
                    ServeClient(wsCtx.WebSocket);
                }
                else
                {
                    ctx.Response.StatusCode = 400;
                }
            }

            listener.Stop();
        }

        // Mix audio chunks together
        private float[] MixChunks(IList<float[]> chunks)
        {
            int chunksCount = chunks.Count();

            for (int i = 0; i < SampleSize; i++)
            {
                mixedChunk[i] = chunks[0][i];
                for(int j = 1; j < chunksCount; j++)
                {
                    mixedChunk[i] += chunks[j][i];
                }
                mixedChunk[i] /= (float)chunksCount;
            }

            return mixedChunk;
        }

        private async Task BroadcastBuffer()
        {
            Monitor.Enter(clients);

            var currentChunks = clients.Values
                .Where(q => q.Count > 0)
                .Select(q => q.Dequeue())
                .ToArray();

            var mixed = MixChunks(currentChunks);

            foreach (var socket in clients.Keys)
            {
                var audioBytes = new byte[SampleBytes];
                Buffer.BlockCopy(mixed, 0, audioBytes, 0, SampleBytes);
                await SendData(socket, audioBytes);
            }

            Monitor.Exit(clients);
        }

        // Update all state
        private async Task UpdateState()
        {
            try
            {
                while (running)
                {
                    if(clients.Values.Any(q => q.Count >= BufferSize))
                    {
                        await BroadcastBuffer();
                    }
                    Thread.Sleep(1);
                }
            }
            catch (Exception e) { }
        }

        private AudioTest()
        {
            clients = new Dictionary<WebSocket, Queue<float[]>>();
            mixedChunk = new float[SampleSize];
        }

        static AudioTest()
        {
            Instance = new AudioTest();
        }
    }
}