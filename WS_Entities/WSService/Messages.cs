using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using WS.Models;
using WS.Utils;

namespace WS.WSService
{
    /// <summary>
    /// Type of message
    /// </summary>
    public enum MessageType : byte
    {
        Close, FieldParams,
        CheckMove, ResultMove, 
        Entities, ClientConnected
    }

    /// <summary>
    /// Deserializes byte array to communication message
    /// </summary>
    public static class Messages
    {
        /// <summary>
        /// Deserialize byte array to corresponding message
        /// </summary>
        /// <param name="messageData">Array of message bytes</param>
        /// <returns>Communication message</returns>
        public static IMessage GetMessageFromBytes(byte[] messageData)
        {
            MessageType type = (MessageType)messageData[0];

            switch(type)
            {
                case MessageType.Close:
                    return new CloseMessage();
                case MessageType.CheckMove:
                    return new CheckMoveMessage(messageData);
                default:
                    return null;
            }
        }

        /// <summary>
        /// Get message type value as byte
        /// </summary>
        /// <param name="msg">Message type</param>
        /// <returns>Byte representation</returns>
        public static byte Value(this MessageType msg)
        {
            return (byte)msg;
        }
    }

    /// <summary>
    /// Close communication session
    /// </summary>
    public class CloseMessage : IMessage
    {
        /// <summary>
        /// Get closing message bytes
        /// </summary>
        public byte[] ToBytes()
        {
            byte code = MessageType.Close.Value();
            return new ByteArrayBuilder("b").Append(code).Build();
        }
    }

    /// <summary>
    /// Field parameters
    /// </summary>
    public class FieldMessage : IMessage
    {
        /// <summary>
        /// Size of field
        /// </summary>
        public int Size { get; set; }

        /// <summary>
        /// Initial horizontal coordinate
        /// </summary>
        public Vector Position { get; set; }

        /// <summary>
        /// Obstacles on the field
        /// </summary>
        public IList<Box> Obstacles { get; set; }

        /// <summary>
        /// Get message bytes
        /// </summary>
        public byte[] ToBytes()
        {
            int obstaclesSize = Obstacles.Count * 4;
            string fmt = String.Concat("b,i,i,i,i,i", obstaclesSize);

            var bufferBuilder = new ByteArrayBuilder(fmt)
                .Append(MessageType.FieldParams.Value())
                .Append(Size)
                .Append(Position.X)
                .Append(Position.Y)
                .Append(Obstacles.Count);

            foreach(var box in Obstacles)
            {
                bufferBuilder.Append(box.X).Append(box.Y);
                bufferBuilder.Append(box.Width).Append(box.Height);
            }

            return bufferBuilder.Build();
        }

        public FieldMessage(Client newClient, IList<Box> obstacles)
        {
            Size = Field.Size;
            Obstacles = obstacles;
            Position = newClient.Position;
        }
    }

    /// <summary>
    /// Can client entity move in given direction
    /// </summary>
    public class CheckMoveMessage : IMessage {

        /// <summary>
        /// Moving velocity
        /// </summary>
        public Vector Velocity { get; set; }

        public byte[] ToBytes()
        {
            throw new NotImplementedException();
        }

        public CheckMoveMessage(byte[] msgBytes)
        {
            var dataReader = new ByteArrayReader(msgBytes, 1);

            int vX = dataReader.ReadInt32();
            int vY = dataReader.ReadInt32();
            Velocity = new Vector(vX, vY);
        }
    }

    /// <summary>
    /// Resulting move direcion
    /// </summary>
    public class ResultMoveMessage : IMessage
    {
        /// <summary>
        /// Result velocity to move
        /// </summary>
        public Vector Velocity { get; set; }

        /// <summary>
        /// Get byte representation
        /// </summary>
        /// <returns>Message bytes</returns>
        public byte[] ToBytes()
        {
            return new ByteArrayBuilder("b,i,i")
                .Append(MessageType.ResultMove.Value())
                .Append(Velocity.X)
                .Append(Velocity.Y)
                .Build();
        }

        public ResultMoveMessage(Vector velocity)
        {
            this.Velocity = velocity;
        }
    }

    /// <summary>
    /// Represents information about all entities
    /// </summary>
    public class EntitiesMessage : IMessage
    {
        /// <summary>
        /// All entities on field
        /// </summary>
        public IList<Client> Entities { get; set; }

        /// <summary>
        /// Get byte representation
        /// </summary>
        /// <returns>Message bytes</returns>
        public byte[] ToBytes()
        {
            int dataLength = Entities.Count * 5;
            string format = String.Concat("b,i,i", dataLength);

            var bufferBuilder = new ByteArrayBuilder(format)
                .Append(MessageType.Entities.Value())
                .Append(Entities.Count);

            foreach(var entity in Entities)
            {
                bufferBuilder.Append(entity.Id);
                bufferBuilder.Append(entity.Position.X);
                bufferBuilder.Append(entity.Position.Y);
                bufferBuilder.Append(entity.Velocity.X);
                bufferBuilder.Append(entity.Velocity.Y);
            }

            return bufferBuilder.Build();
        }

        public EntitiesMessage(IList<Client> entities)
        {
            this.Entities = entities;
        }
    }

    /// <summary>
    /// New client connected
    /// </summary>
    public class ConnectedMessage : IMessage
    {
        const int MaxNameLength = 64;

        /// <summary>
        /// Connected clients' info
        /// </summary>
        public IList<Client> ClientsInfo { get; set; }

        public byte[] ToBytes()
        {
            var fmt = ClientsInfo.Select(_ => String.Concat("i,b", MaxNameLength));
            string fmtString = String.Join(",", fmt);

            var bufferBuilder = new ByteArrayBuilder(String.Concat("b,i,", fmtString))
                .Append(MessageType.ClientConnected.Value())
                .Append(ClientsInfo.Count);

            foreach (var client in ClientsInfo)
            {
                bufferBuilder.Append(client.Id);
                string paddedName = client.Name.PadRight(MaxNameLength);
                var nameBytes = Encoding.UTF8.GetBytes(paddedName);
                bufferBuilder.Append(nameBytes);
            }

            return bufferBuilder.Build();
        }

        public ConnectedMessage(IList<Client> clients)
        {
            this.ClientsInfo = clients;
        }
    }
}