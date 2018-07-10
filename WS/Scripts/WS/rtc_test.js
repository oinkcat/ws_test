var RTCTest;
(function (RTCTest) {
    // Signalling server URL
    var SERVER_ENDPOINT = "ws://localhost:5678/wsrtc/";
    var socket;
    var myPeerConn;
    var labels;
    var myAudioElem;
    var localStream;
    var offerOption = { offerToReceiveAudio: 1 };
    // On connection
    function socketConnected() {
        console.log("Connected to server!");
        labels.eq(0).removeClass("hidden");
    }
    // On network error
    function socketError() {
        console.log("Connection error!");
        labels.eq(1).removeClass("hidden");
    }
    // On receive data from server
    function socketMessage(e) {
        var msg = JSON.parse(e.data);
        processMessage(msg);
    }
    // Process signalling server message
    function processMessage(msg) {
        var payload = msg.data;
        if (msg.type == "offer") {
            startActivity(payload);
        }
        else if (msg.type == "answer") {
            completePairing(payload);
        }
        else if (msg.type == "ice") {
            if (myPeerConn != null) {
                myPeerConn.addIceCandidate(payload);
            }
        }
    }
    // Send message to signalling server
    function sendMessage(msg) {
        socket.send(JSON.stringify(msg));
    }
    /** Connect audio processing server */
    function connectSignallingServer() {
        socket = new WebSocket(SERVER_ENDPOINT);
        socket.onopen = socketConnected;
        socket.onerror = socketError;
        socket.onmessage = socketMessage;
        var initMsg = {
            type: "init",
            data: null
        };
        sendMessage(initMsg);
    }
    function localOfferCreated(desc) {
        console.log("Offer created!");
        myPeerConn.setLocalDescription(desc);
        var offerMsg = {
            type: "offer",
            data: desc
        };
        sendMessage(offerMsg);
    }
    function answerCreated(desc) {
        console.log("Answer created!");
        myPeerConn.setLocalDescription(desc);
        var answerMessage = {
            type: "answer",
            data: desc
        };
        sendMessage(answerMessage);
    }
    function onConnection(e) {
        var iceMsg = {
            type: "ice",
            data: e.candidate
        };
        sendMessage(iceMsg);
    }
    function onConnectionChange(e) {
        console.dir(e);
        debugger;
    }
    function startRTCConnection(myMediaStream, offer) {
        // Listen local stream
        myAudioElem.srcObject = myMediaStream;
        myAudioElem.play();
        var config = null;
        myPeerConn = new RTCPeerConnection(config);
        myPeerConn.onicecandidate = onConnection;
        myPeerConn.oniceconnectionstatechange = onConnectionChange;
        myPeerConn.addStream(myMediaStream);
        if (offer == null) {
            // Caller
            myPeerConn.createOffer(offerOption)
                .then(localOfferCreated)
                .catch(function () { return console.log("Failed to create offer!"); });
        }
        else {
            // Callee
            var remoteDesc = new RTCSessionDescription(offer);
            myPeerConn.setRemoteDescription(remoteDesc)
                .then(function () { return console.log("Remote description set!"); })
                .catch(function (e) { return console.log(e); });
            myPeerConn.createAnswer(offerOption)
                .then(answerCreated)
                .catch(function (e) { return console.log(e); });
        }
    }
    function completePairing(answer) {
        var description = new RTCSessionDescription(answer);
        myPeerConn.setRemoteDescription(description)
            .then(function () { return console.log("Remote description set!"); })
            .catch(function () { return console.log("Remote description set error!"); });
    }
    function startActivity(offer) {
        navigator.getUserMedia({
            audio: {
                sampleRate: 16000
            },
            video: false
        }, function (stream) { return startRTCConnection(stream, offer); }, function () { return console.log("Cannot access microphone!"); });
    }
    /** Initialize page UI */
    function initializeUi() {
        labels = $("h2 .label");
        myAudioElem = $("#myAudio")[0];
        $(".controls button").click(function (e) {
            $(e.target).addClass("disabled");
            startActivity();
        });
    }
    /** Initialize RTC peer */
    function initialize() {
        initializeUi();
        connectSignallingServer();
    }
    RTCTest.initialize = initialize;
})(RTCTest || (RTCTest = {}));
$(function () { return RTCTest.initialize(); });
//# sourceMappingURL=rtc_test.js.map