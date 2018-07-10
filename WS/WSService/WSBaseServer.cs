using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Net;
using System.Net.WebSockets;

namespace WS.WSService
{
    /// <summary>
    /// Base WebSocket server
    /// </summary>
    public abstract class WSBaseServer
    {
        // Default message size for receive
        private const int MessageSize = 16384;

        /// <summary>
        /// Is server running
        /// </summary>
        protected bool running;
        
        /// <summary>
        /// Server listener task
        /// </summary>
        protected Task serverTask;

        /// <summary>
        /// Start additional tasks
        /// </summary>
        protected virtual void StartTasks() { }

        /// <summary>
        /// WebSocket endpoint address
        /// </summary>
        protected abstract string EndpointAddress { get; }

        /// <summary>
        /// Serve new connected client
        /// </summary>
        /// <param name="clientSocket">Connected client's socket</param>
        protected abstract void ServeClient(WebSocket clientSocket);

        /// <summary>
        /// Start the server
        /// </summary>
        public void Start()
        {
            if(!running)
            {
                running = true;

                var option = TaskCreationOptions.LongRunning;
                serverTask = Task.Factory.StartNew(new Func<Task>(StartServer), option);

                StartTasks();
            }
        }

        /// <summary>
        /// Stop the server
        /// </summary>
        public void Stop()
        {
            running = false;
        }

        // Create and return buffer for new message
        protected async Task<byte[]> ReceiveData(WebSocket s)
        {
            var buffer = new ArraySegment<byte>(new byte[MessageSize]);
            await s.ReceiveAsync(buffer, CancellationToken.None);
            return buffer.Array;
        }

        // Send text message to client
        protected async Task SendText(WebSocket s, string message)
        {
            var textBuffer = new ArraySegment<byte>(Encoding.UTF8.GetBytes(message));
            var ct = CancellationToken.None;
            await s.SendAsync(textBuffer, WebSocketMessageType.Text, true, ct);
        }

        // Send binary message to client
        protected async Task SendMessage(WebSocket s, IMessage msg)
        {
            var buffer = new ArraySegment<byte>(msg.ToBytes());
            var ct = CancellationToken.None;
            Monitor.Enter(s);
            await s.SendAsync(buffer, WebSocketMessageType.Binary, true, ct);
            Monitor.Exit(s);
        }

        // Create server and wait for clients
        private async Task StartServer()
        {
            var listener = new HttpListener();
            listener.Prefixes.Add(EndpointAddress);
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
    }
}