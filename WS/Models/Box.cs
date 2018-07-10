using System;
using System.Collections.Generic;
using System.Linq;

namespace WS.Models
{
    /// <summary>
    /// Two dimensional rectangle object
    /// </summary>
    public class Box
    {
        /// <summary>
        /// Horizontal coordinate
        /// </summary>
        public int X { get; set; }

        /// <summary>
        /// Vertical coordinate
        /// </summary>
        public int Y { get; set; }

        /// <summary>
        /// Box width
        /// </summary>
        public int Width { get; set; }

        /// <summary>
        /// Box height
        /// </summary>
        public int Height { get; set; }

        /// <summary>
        /// Check collision of box with point
        /// </summary>
        /// <param name="client">Client to test</param>
        /// <returns>Collision direction</returns>
        public Vector CheckCollision(Client client)
        {
            // Collision check function
            Func<int, int, bool> check = (dx, dy) => {
                int x = client.Position.X + dx;
                int y = client.Position.Y + dy;
                bool collX = x >= X && x <= (X + Width);
                bool collY = y > Y && y <= (Y + Height);
                return collX && collY;
            };

            if (check(client.Velocity.X, 0))
                return new Vector(1, 0);

            if (check(0, client.Velocity.Y))
                return new Vector(0, 1);

            return null;
        }

        public Box(int x, int y, int w, int h)
        {
            this.X = x;
            this.Y = y;
            this.Width = w;
            this.Height = h;
        }
    }
}