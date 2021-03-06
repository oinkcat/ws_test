﻿using System;
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
            OnlineActivity.Instance.Start();

            string serverAddress = OnlineActivity.Instance.EndpointAddress;
            string addressForClient = serverAddress.Replace("http:", "ws:");

            return View(addressForClient as object);
        }
    }
}