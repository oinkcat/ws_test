using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Net.WebSockets;
using System.Text;
using System.Configuration;
using Newtonsoft.Json;

namespace WS.WSService
{
    /// <summary>
    /// WebSocket RTC signalling server
    /// </summary>
    public class RTCTest : WSBaseServer
    {
        /// <summary>
        /// WebRTC communication message
        /// </summary>
        private class RTCMessage
        {
            public string Type { get; set; }

            public object Data { get; set; }

            public Guid Target { get; set; }
        }

        /// <summary>
        /// RTC client info
        /// </summary>
        private class ClientContext
        {
            public bool IsReady { get; set; }

            public WebSocket Socket { get; set; }

            public ClientContext(WebSocket socket)
            {
                this.Socket = socket;
            }
        }

        private const string WSAddressConfigName = "WSServiceAddress";

        /// <summary>
        /// Server instance
        /// </summary>
        public static RTCTest Instance { get; set; }

        protected override string EndpointAddress =>
            ConfigurationManager.AppSettings[WSAddressConfigName];

        // Connected clients
        private Dictionary<Guid, ClientContext> clients;

        // Send RTC message to client
        private async Task SendMessage(RTCMessage msg, WebSocket target)
        {
            await SendText(target, JsonConvert.SerializeObject(msg));
        }

        // Process incoming message
        private async Task ProcessMessage(RTCMessage msg, ClientContext client)
        {
            string[] allowedTypes = { "init", "offer", "answer", "ice" };

            if(allowedTypes.Contains(msg.Type))
            {
                switch(msg.Type)
                {
                    case "init":
                        // Another client is ready
                        client.IsReady = true;
                        var readyMsg = new RTCMessage {
                            Type = "ready_clients",
                            Data = clients.Where(kv => kv.Value != client &&
                                                       kv.Value.IsReady)
                                          .Select(kv => kv.Key)
                                          .ToArray()
                        };
                        await SendMessage(readyMsg, client.Socket);
                        break;
                    default:
                        // Transfer to paired client
                        var anotherPeer = clients[msg.Target];
                        // Redirect answer
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

            while(true)
            {
                var msgBytes = await ReceiveData(client.Socket);
                string msgJson = Encoding.UTF8.GetString(msgBytes).Trim('\0');
                var message = JsonConvert.DeserializeObject<RTCMessage>(msgJson);

                if(message != null)
                {
                    await ProcessMessage(message, client);
                }
            }
        }

        // Process new connected socket
        protected override async void ServeClient(WebSocket socket)
        {
            Guid clientId = Guid.NewGuid();

            try
            {
                clients.Add(clientId, new ClientContext(socket));
                await CommunicateWithClient(clientId);
            }
            catch (WebSocketException)
            {
                // Client disconnected
                clients.Remove(clientId);
            }
        }

        private RTCTest()
        {
            clients = new Dictionary<Guid, ClientContext>();
        }

        static RTCTest()
        {
            Instance = new RTCTest();
        }
    }
}