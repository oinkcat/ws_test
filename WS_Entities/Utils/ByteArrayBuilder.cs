using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace WS.Utils
{
    /// <summary>
    /// Build byte array
    /// </summary>
    public class ByteArrayBuilder
    {
        // Cache
        private static Dictionary<string, int> formatSizes;

        // Storage
        private byte[] buffer;

        // Current index in buffer for copy
        private int index;

        /// <summary>
        /// Get result
        /// </summary>
        /// <returns>Byte array</returns>
        public byte[] Build()
        {
            return buffer;
        }

        /// <summary>
        /// Append byte chunk to buffer
        /// </summary>
        /// <param name="chunk">Chunk of bytes</param>
        /// <returns>Same builder</returns>
        public ByteArrayBuilder Append(byte[] chunk)
        {
            chunk.CopyTo(buffer, index);
            index += chunk.Length;

            return this;
        }

        /// <summary>
        /// Append single byte to array
        /// </summary>
        /// <param name="value">Value to append</param>
        /// <returns>Same builder</returns>
        public ByteArrayBuilder Append(byte value)
        {
            buffer[index++] = value;

            return this;
        }

        /// <summary>
        /// Append Int32 value to array
        /// </summary>
        /// <param name="value">Value to append</param>
        /// <returns>Same builder</returns>
        public ByteArrayBuilder Append(Int32 value)
        {
            return Append(BitConverter.GetBytes(value));
        }

        /// <summary>
        /// Append Int64 value to array
        /// </summary>
        /// <param name="value">Value to append</param>
        /// <returns>Same builder</returns>
        public ByteArrayBuilder Append(Int64 value)
        {
            return Append(BitConverter.GetBytes(value));
        }

        // Return size in bytes for specific format
        private int GetSizeForFormat(string fmt)
        {
            int totalSize = 0;

            foreach(string part in fmt.ToLower().Split(','))
            {
                char type = part[0];
                int length = 1;

                if(part.Length > 1)
                {
                    length = int.Parse(part.Substring(1));
                }

                int elemSize = 0;
                switch(type)
                {
                    case 'b':
                        elemSize = sizeof(byte);
                        break;
                    case 'i':
                        elemSize = sizeof(Int32);
                        break;
                    case 'l':
                        elemSize = sizeof(Int64);
                        break;
                    case 'f':
                        elemSize = sizeof(float);
                        break;
                    default:
                        throw new FormatException("Invalid format string!");
                }

                totalSize += elemSize * length;
            }

            return totalSize;
        }

        public ByteArrayBuilder(string format)
        {
            // Use cache
            if(!formatSizes.ContainsKey(format))
            {
                int bufferSize = GetSizeForFormat(format);
                formatSizes.Add(format, bufferSize);
            }

            buffer = new byte[formatSizes[format]];
            index = 0;
        }

        static ByteArrayBuilder()
        {
            formatSizes = new Dictionary<string, int>();
        }
    }
}