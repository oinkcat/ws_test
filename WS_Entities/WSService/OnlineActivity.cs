﻿using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Text;
using System.Configuration;
using System.Net.WebSockets;
using WS.Models;

namespace WS.WSService
{
    /// <summary>
    /// Realtime online activity demo
    /// </summary>
    public class OnlineActivity : WSBaseServer
    {
        private const string WSAddressConfigName = "WSServiceAddress";

        // Session start token
        private const string StartToken = "start";

        /// <summary>
        /// Server instance
        /// </summary>
        public static OnlineActivity Instance { get; set; }

        private Task updaterTask;

        private Field field;
        private BotsHandler botsMgr;

        // WebSocket to client mapping
        private Dictionary<WebSocket, Client> clients;

        // Server endpoint address
        public override string EndpointAddress =>
            ConfigurationManager.AppSettings[WSAddressConfigName];

        // Start additional tasks
        protected override void StartTasks()
        {
            var option = TaskCreationOptions.LongRunning;
            updaterTask = Task.Factory.StartNew(new Func<Task>(UpdateState), option);
        }

        // Process new connected socket
        protected override async void ServeClient(WebSocket socket)
        {
            try
            {
                await CommunicateWithClient(socket);
            }
            catch (WebSocketException)
            {
                // Client disconnected - remove from field
                lock(clients)
                {
                    field.RemoveClient(clients[socket]);
                    clients.Remove(socket);
                }
            }
        }

        // Process message received from client
        private IMessage ProcessIncomingMessage(IMessage msg, Client client)
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
        private async Task CommunicateWithClient(WebSocket socket)
        {
            var client = await RegisterClient(socket);

            if (client == null)
                throw new Exception("Client wasn't registered!");

            // Send parameters
            await SendMessage(socket, new FieldMessage(client, field.Obstacles));
            await SendMessage(socket, new ConnectedMessage(field.Clients));

            IMessage incomingMsg = null;
            do
            {
                byte[] messageBytes = await ReceiveData(socket);
                incomingMsg = Messages.GetMessageFromBytes(messageBytes);

                var answer = ProcessIncomingMessage(incomingMsg, client);
                if (answer != null)
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
                field.AddClient(client);
                string info = String.Concat(client.Id, '|', client.Name);
                await SendText(socket, info);
                clients.Add(socket, client);
                return client;
            }
            else
                return null;
        }

        // Send entities info to clients
        private async Task SendEntitiesInfo()
        {
            var message = new EntitiesMessage(field.Clients);

            Monitor.Enter(clients.Keys);
            foreach(var clientSocket in clients.Keys)
            {
                await SendMessage(clientSocket, message);
            }
            Monitor.Exit(clients.Keys);
        }

        // Update all state
        private async Task UpdateState()
        {
            while (running)
            {
                try
                {
                    botsMgr.UpdateBots();
                    await SendEntitiesInfo();
                    await Task.Delay(30);
                }
                catch { }
            }
        }

        private OnlineActivity()
        {
            field = new Field();

            botsMgr = new BotsHandler(field);
            botsMgr.CreateBots();

            clients = new Dictionary<WebSocket, Client>();
        }

        static OnlineActivity()
        {
            Instance = new OnlineActivity();
        }
    }
}