using System;
using System.Collections.Generic;
using System.Linq;

namespace WS.Models
{
    /// <summary>
    /// WebSocket test client abstraction
    /// </summary>
    public class Client
    {
        /// <summary>
        /// Numeric Id
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Client name
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Entity position
        /// </summary>
        public Vector Position { get; set; }

        /// <summary>
        /// Entity velocity
        /// </summary>
        public Vector Velocity { get; set; }

        /// <summary>
        /// Is client a bot
        /// </summary>
        public bool IsBot { get; set; }

        public Client()
        {
            var rnd = new Random();
            Id = rnd.Next();
            Name = String.Concat("client_", Id);
            this.Velocity = new Vector(0, 0);
        }

        public Client(string id)
        {
            Id = int.Parse(id.Split('_')[1]);
            this.Name = id;
        }
    }
}