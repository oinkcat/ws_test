using System;

namespace WS.Models
{
    /// <summary>
    /// 2-coordinate vector
    /// </summary>
    public class Vector
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
        /// Sum two vectors
        /// </summary>
        /// <param name="one">Vector 1</param>
        /// <param name="another">Vector 2</param>
        /// <returns>Sum of vectors</returns>
        public static Vector operator +(Vector one, Vector another)
        {
            return new Vector(one.X + another.X, one.Y + another.Y);
        }

        public Vector(int x, int y)
        {
            this.X = x;
            this.Y = y;
        }
    }
}