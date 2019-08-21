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
        /// Actual WebSocket endpoint
        /// </summary>
        public string ActualEndpointAddress { get; set; }

        /// <summary>
        /// Start the server
        /// </summary>
        public void Start()
        {
            if(!running)
            {
                running = true;
                ActualEndpointAddress = GetMyEndpointAddress();

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

        // Get endpoint address from address template
        private string GetMyEndpointAddress()
        {
            if(EndpointAddress.StartsWith("http://"))
            {
                string[] addrParts = EndpointAddress.Split('/');
                string[] ipAndPort = addrParts[2].Split(':');
                string ip = ipAndPort[0];

                if(ip.EndsWith("*"))
                {
                    string prefix = ip.Substring(0, ip.Length - 1);
                    string myIpAddr = Dns.GetHostAddresses(Dns.GetHostName())
                        .First(addr => addr.ToString().StartsWith(prefix))
                        .ToString();
                    ipAndPort[0] = myIpAddr;

                    addrParts[2] = String.Concat(ipAndPort[0], ':', ipAndPort[1]);

                    return String.Join("/", addrParts);
                }
                else
                {
                    return EndpointAddress;
                }
            }
            else
            {
                throw new FormatException("Invalid Endpoint address!");
            }
        }

        // Create server and wait for clients
        private async Task StartServer()
        {
            var listener = new HttpListener();
            listener.Prefixes.Add(ActualEndpointAddress);
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