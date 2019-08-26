using System;
using System.Net;
using System.Web.Mvc;
using WS.WSService;

namespace WS.Controllers
{
    /// <summary>
    /// Main controller
    /// </summary>
    public class HomeController : Controller
    {
        /// <summary>
        /// Main page request handler
        /// </summary>
        public ActionResult Index()
        {
            string serverAddress = $"ws://{Request.Url.Authority}/Home/WS";

            return View(serverAddress as object);
        }

        /// <summary>
        /// Client WebSocket address
        /// </summary>
        public HttpStatusCodeResult WS()
        {
            if (HttpContext.IsWebSocketRequest)
            {
                var handler = new RTCTest();
                HttpContext.AcceptWebSocketRequest(handler.HandleClient);
            }

            return new HttpStatusCodeResult(HttpStatusCode.SwitchingProtocols);
        }
    }
}