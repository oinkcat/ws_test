using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Text;
using System.Net;
using System.Net.WebSockets;
using WS.Models;

namespace WS.WSService
{
    /// <summary>
    /// WebSocket server
    /// </summary>
    public class WSServer
    {
        private const string WSEndpoint = "http://0.0.0.0:8080/ws/";

        private const string StartToken = "start";

        private const int MessageSize = 1024;

        /// <summary>
        /// Server instance
        /// </summary>
        public static WSServer Instance { get; set; }

        private Task serverTask;
        private Task updaterTask;

        private Field field;
        private BotsHandler botsMgr;

        // WebSocket to client mapping
        private Dictionary<WebSocket, Client> clients;

        private bool running;

        /// <summary>
        /// Start WebSocket server
        /// </summary>
        public void Start()
        {
            running = true;

            var option = TaskCreationOptions.LongRunning;
            serverTask = Task.Factory.StartNew(new Func<Task>(StartServer), option);
            updaterTask = Task.Factory.StartNew(new Func<Task>(UpdateState), option);
        }

        /// <summary>
        /// Stop server
        /// </summary>
        public void Stop()
        {
            running = false;
        }

        // Process message received from client
        private Message ProcessIncomingMessage(Message msg, Client client)
        {
            if(msg is CheckMoveMessage)
            {
                client.Velocity = (msg as CheckMoveMessage).Velocity;
                field.UpdateClient(client);
                return new ResultMoveMessage(client.Velocity);
            }
            else
            {
                return null;
            }
        }

        // Communicate with client
        private async Task ServeClient(WebSocket socket)
        {
            var client = await RegisterClient(socket);

            if (client == null)
                throw new Exception("Client wasn't registered!");

            // Send parameters
            await SendMessage(socket, new FieldMessage(client, field.Obstacles));

            Message incomingMsg = null;
            do
            {
                byte[] messageBytes = await ReceiveData(socket);
                incomingMsg = Messages.GetMessageFromBytes(messageBytes);

                var answer = ProcessIncomingMessage(incomingMsg, client);
                if(answer != null)
                {
                    await SendMessage(socket, answer);
                }
            }
            while (incomingMsg != null);
        }

        // Get new registered client
        private async Task<Client> RegisterClient(WebSocket socket)
        {
            // Wait for start token
            byte[] received = await ReceiveData(socket);
            string token = Encoding.UTF8.GetString(received);

            if (token.Trim('\0') == StartToken)
            {
                var client = new Client();
                clients.Add(socket, client);
                field.AddClient(client);
                await SendText(socket, client.Name);
                return client;
            }
            else
                return null;
        }

        // Create and return buffer for new message
        private async Task<byte[]> ReceiveData(WebSocket s)
        {
            var buffer = new ArraySegment<byte>(new byte[MessageSize]);
            await s.ReceiveAsync(buffer, CancellationToken.None);
            return buffer.Array;
        }

        // Send text message to client
        private async Task SendText(WebSocket s, string message)
        {
            var textBuffer = new ArraySegment<byte>(Encoding.UTF8.GetBytes(message));
            var ct = CancellationToken.None;
            await s.SendAsync(textBuffer, WebSocketMessageType.Text, true, ct);
        }

        // Send binary message to client
        private async Task SendMessage(WebSocket s, Message msg)
        {
            var buffer = new ArraySegment<byte>(msg.ToBytes());
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

                    try
                    {
                        await ServeClient(wsCtx.WebSocket);
                    }
                    catch (WebSocketException)
                    {
                        // Client disconnected - remove from field
                        field.RemoveClient(clients[wsCtx.WebSocket]);
                    }
                }
                else
                {
                    ctx.Response.StatusCode = 400;
                }
            }

            listener.Stop();
        }

        // Send entities info to clients
        private async Task SendEntitiesInfo()
        {
            var message = new EntitiesMessage(field.Clients);

            foreach(var clientSocket in clients.Keys)
            {
                await SendMessage(clientSocket, message);
            }
        }

        // Update all state
        private async Task UpdateState()
        {
            try
            {
                while(running)
                {
                    botsMgr.UpdateBots();
                    await SendEntitiesInfo();
                    Thread.Sleep(30);
                }
            }
            catch(Exception e) { }
        }

        private WSServer()
        {
            field = new Field();

            botsMgr = new BotsHandler(field);
            botsMgr.CreateBots();

            clients = new Dictionary<WebSocket, Client>();
        }

        static WSServer()
        {
            Instance = new WSServer();
        }
    }
}