using System;
using System.Collections.Generic;
using System.Linq;

namespace WS.Models
{
    /// <summary>
    /// Field filled with boxes and moving entities
    /// </summary>
    public class Field
    {
        /// <summary>
        /// Field dimensions in pixels
        /// </summary>
        public const int Size = 2000;

        /// <summary>
        /// All clients in field
        /// </summary>
        public IList<Client> Clients { get; private set; }

        /// <summary>
        /// All obstacles
        /// </summary>
        public IList<Box> Obstacles { get; private set; }

        /// <summary>
        /// Add new client to the field
        /// </summary>
        /// <param name="client">Client to add</param>
        public void AddClient(Client client)
        {
            if(!client.IsBot)
            {
                var rnd = new Random();
                client.Position = new Vector(rnd.Next(Size), rnd.Next(Size));
            }

            lock(Clients)
            {
                Clients.Add(client);
            }
        }

        /// <summary>
        /// Remove client from the field
        /// </summary>
        /// <param name="client">Client to remove</param>
        public void RemoveClient(Client client)
        {
            lock(Clients)
            {
                Clients.Remove(client);
            }
        }

        /// <summary>
        /// Update client position on the field
        /// </summary>
        /// <param name="client">Client to update state</param>
        public void UpdateClient(Client client)
        {
            Vector targetPoint = client.Position + client.Velocity;

            bool collisionX = false;
            bool collisionY = false;

            // Check collision with walls
            collisionX = targetPoint.X < 0 || targetPoint.X >= Size;
            collisionY = targetPoint.Y < 0 || targetPoint.Y >= Size;

            // Check collision with obstacles
            if (!(collisionX || collisionY))
            {
                foreach(var box in Obstacles)
                {
                    if (Math.Abs(targetPoint.X - box.X) > box.Width)
                        continue;

                    var collisionDir = box.CheckCollision(client);
                    if(collisionDir != null)
                    {
                        collisionX = collisionDir.X > 0;
                        collisionY = collisionDir.Y > 0;
                        break;
                    }
                }
            }

            if (collisionX)
                client.Velocity.X = -client.Velocity.X;
            if (collisionY)
                client.Velocity.Y = -client.Velocity.Y;

            client.Position += client.Velocity;
        }

        // Generate list of random obstacles
        private void GenerateObstacles()
        {
            const int NumOfObstacles = 50;
            const int MinSize = 50;
            const int SizeLimit = 50;

            var rnd = new Random();
            for(int i = 0; i < NumOfObstacles; i++)
            {
                int x = rnd.Next(Size);
                int y = rnd.Next(Size);
                int width = rnd.Next(MinSize, MinSize + SizeLimit);
                int height = rnd.Next(MinSize, MinSize + SizeLimit);

                Obstacles.Add(new Box(x, y, width, height));
            }
        }

        public Field()
        {
            this.Clients = new List<Client>();
            this.Obstacles = new List<Box>();
            this.GenerateObstacles();
        }
    }
}