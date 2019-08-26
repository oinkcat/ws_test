using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Net.WebSockets;
using System.Text;
using Newtonsoft.Json;

namespace WS.WSService
{
    /// <summary>
    /// WebSocket RTC signalling server
    /// </summary>
    public class RTCTest
    {
        const string MessageInit = "init";
        const string MessageOffer = "offer";
        const string MessageAnswer = "answer";
        const string MessageIce = "ice";
        const string MessageAvailableClients = "ready_clients";
        const string MessageDisconnected = "disconnected";

        /// <summary>
        /// WebRTC communication message
        /// </summary>
        private class RTCMessage
        {
            public string Type { get; set; }

            public object Data { get; set; }

            public Guid Target { get; set; }

            public RTCMessage() { }

            public RTCMessage(string type)
            {
                Type = type;
            }
        }

        /// <summary>
        /// RTC client info
        /// </summary>
        private class RTCClientContext
        {
            public bool IsReady { get; set; }

            public WebSocket Socket { get; set; }

            public RTCClientContext(WebSocket socket)
            {
                this.Socket = socket;
            }
        }

        // Connected clients
        private static Dictionary<Guid, RTCClientContext> clients;

        // Identifiers of disconnected clients
        private static BlockingCollection<Guid> disconnectedIds;

        // Watches for disconnected clients
        private static Task disconnectWatcherTask;

        // Process incoming message
        private async Task ProcessMessage(RTCMessage msg, RTCClientContext client)
        {
            string[] allowedTypes = {
                MessageInit, MessageOffer, MessageAnswer, MessageIce
            };

            if (allowedTypes.Contains(msg.Type))
            {
                switch (msg.Type)
                {
                    case MessageInit:
                        // Another client is ready
                        client.IsReady = true;
                        var readyMsg = new RTCMessage(MessageAvailableClients)
                        {
                            Data = clients.Where(kv => kv.Value != client &&
                                                       kv.Value.IsReady)
                                          .Select(kv => kv.Key)
                                          .ToArray(),
                            Target = clients.Single(kv => kv.Value == client).Key
                        };
                        await SendMessage(readyMsg, client.Socket);
                        break;
                    default:
                        // Transfer to paired client
                        var anotherPeer = clients[msg.Target];
                        // Relay message
                        msg.Target = clients.Single(kv => kv.Value == client).Key;
                        await SendMessage(msg, anotherPeer.Socket);
                        break;
                }
            }
        }

        // Communicate with client
        private async Task CommunicateWithClient(Guid clientId)
        {
            var client = clients[clientId];

            while (true)
            {
                var msgBytes = await ReceiveData(client.Socket);
                string msgJson = Encoding.UTF8.GetString(msgBytes).Trim('\0');
                
                var message = JsonConvert.DeserializeObject<RTCMessage>(msgJson);

                if (message != null)
                {
                    await ProcessMessage(message, client);
                }
            }
        }

        // Process new connected socket
        private async Task ServeClient(WebSocket socket)
        {
            Guid clientId = Guid.NewGuid();

            try
            {
                clients.Add(clientId, new RTCClientContext(socket));
                await CommunicateWithClient(clientId);
            }
            catch
            {
                // Client disconnected or other error
                clients.Remove(clientId);
                disconnectedIds.Add(clientId);
            }
        }

        /// <summary>
        /// Handle requests to signalling server
        /// </summary>
        /// <param name="ctx">Client WebSocket context</param>
        public async Task HandleClient(WebSocketContext ctx)
        {
            await ServeClient(ctx.WebSocket);
        }

        // Disconnected clients watcher and notifier
        private async static Task WatchDisconnectedClients()
        {
            while(true)
            {
                // Notify other clients
                var disconnectNotify = new RTCMessage(MessageDisconnected)
                {
                    Target = disconnectedIds.Take()
                };

                foreach(var clientCtx in clients.Values)
                {
                    await SendMessage(disconnectNotify, clientCtx.Socket);
                }
            }
        }

        // Create and return buffer for new message
        private static async Task<byte[]> ReceiveData(WebSocket s)
        {
            const int MaxMessageSize = 16384;

            var msgBytes = new byte[MaxMessageSize];
            int totalSize = 0;
            bool fullyReceived = false;

            while(!fullyReceived)
            {
                int totalLeft = MaxMessageSize - totalSize;
                var buffer = new ArraySegment<byte>(msgBytes, totalSize, totalLeft);

                var recvResult = await s.ReceiveAsync(buffer, CancellationToken.None);
                fullyReceived = recvResult.EndOfMessage;
                totalSize += recvResult.Count;
            }

            return msgBytes;
        }

        // Send RTC message to client
        private static async Task SendMessage(RTCMessage msg, WebSocket socket)
        {
            string jsonMsg = JsonConvert.SerializeObject(msg);
            var textBuffer = new ArraySegment<byte>(Encoding.UTF8.GetBytes(jsonMsg));
            var ct = CancellationToken.None;
            await socket.SendAsync(textBuffer, WebSocketMessageType.Text, true, ct);
        }

        static RTCTest()
        {
            clients = new Dictionary<Guid, RTCClientContext>();
            disconnectedIds = new BlockingCollection<Guid>();

            disconnectWatcherTask = Task.Factory.StartNew(WatchDisconnectedClients);
        }
    }
}