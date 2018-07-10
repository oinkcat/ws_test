using System;

namespace WS.WSService
{
    /// <summary>
    /// Base communication message
    /// </summary>
    public interface IMessage
    {
        /// <summary>
        /// Serialize message to byte array
        /// </summary>
        /// <returns>Array of bytes representing message</returns>
        byte[] ToBytes();
    }
}
