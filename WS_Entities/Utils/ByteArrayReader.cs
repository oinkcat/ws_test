using System;
using System.Collections.Generic;
using System.Linq;

namespace WS.Utils
{
    /// <summary>
    /// Extracts data from byte array
    /// </summary>
    public class ByteArrayReader
    {
        // Data storage
        private byte[] buffer;

        // Position in the array
        private int bufferPos;

        /// <summary>
        /// Read one byte from array
        /// </summary>
        /// <returns>Byte value</returns>
        public byte ReadByte()
        {
            return buffer[bufferPos++];
        }

        /// <summary>
        /// Read Int32 value from array
        /// </summary>
        /// <returns>Int32 value</returns>
        public int ReadInt32()
        {
            int value = BitConverter.ToInt32(buffer, bufferPos);
            bufferPos += sizeof(Int32);

            return value;
        }

        /// <summary>
        /// Read Int32 value from array
        /// </summary>
        /// <returns>Int32 value</returns>
        public long ReadInt64()
        {
            long value = BitConverter.ToInt64(buffer, bufferPos);
            bufferPos += sizeof(Int64);

            return value;
        }

        public ByteArrayReader(byte[] array, int offset = 0)
        {
            this.buffer = array;
            this.bufferPos = offset;
        }
    }
}