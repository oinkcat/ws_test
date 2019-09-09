# WebSocket Samples
Simple WebSocket test applications using TypeScript on client side and two types of WebSocket hosting: 
self-hosting and ASP.NET hosting.

## WS_Entities
This sample represents realtime server-to-client messages transfer to display server state on client side.
Server manages 2D field with moving entities that can interact with obstacles. A view of field is displaying
on client's web page.
It's using custom binary protocol for messages and self-hosting for WebSockets.
Sample works only on IIS Express.

## WS_RTC
This sample demonstrates how to create basic WebRTC signalling server that transfers messages via WebSocket.
Application can manage connections of two or more peers.
Sample uses ASP.NET WebSocket wrappers and works both on IIS Express and IIS.