using System;
using System.Collections.Generic;
using System.Linq;
using WS.Models;

namespace WS.WSService
{
    /// <summary>
    /// Handles bots
    /// </summary>
    public class BotsHandler
    {
        private Field field;

        const int BotsCount = 15;

        /// <summary>
        /// Create all bots
        /// </summary>
        public void CreateBots()
        {
            var rnd = new Random();

            for(int i = 0; i < BotsCount; i++)
            {
                string botId = String.Concat("bot_", rnd.Next(1000));
                int x = rnd.Next(Field.Size);
                int y = rnd.Next(Field.Size);
                int vX = rnd.Next(4) - 2;
                vX = vX > 0 ? vX : 1;
                int vY = rnd.Next(4) - 2;
                vY = vY > 0 ? vY : 1;
                var newBot = new Client(botId)
                {
                    IsBot = true,
                    Position = new Vector(x, y),
                    Velocity = new Vector(vX, vY)
                };
                field.AddClient(newBot);
            }
        }

        /// <summary>
        /// Update all bots
        /// </summary>
        public void UpdateBots()
        {
            try
            {
                foreach (var client in field.Clients)
                {
                    if (!client.IsBot)
                        continue;

                    field.UpdateClient(client);
                }
            }
            catch { }
        }

        public BotsHandler(Field field)
        {
            this.field = field;
        }
    }
}