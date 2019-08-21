using System;
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
            return View();
        }
    }
}