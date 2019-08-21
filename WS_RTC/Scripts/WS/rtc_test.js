var RTCTest;
(function (RTCTest) {
    // Signalling server messages
    var MSG_INIT = "init";
    var MSG_CLIENTS = "ready_clients";
    var MSG_OFFER = "offer";
    var MSG_ANSWER = "answer";
    var MSG_ICE = "ice";
    /** P2P audio connection */
    var RTCAudioConnection = /** @class */ (function () {
        function RTCAudioConnection(remoteId, myStream) {
            var _this = this;
            this.remoteId = remoteId;
            // Peer offer options
            this.offerOption = {
                offerToReceiveAudio: true
            };
            // WebRTC configuration
            this.rtcConfig = {
                iceServers: []
            };
            // Create connection
            this.connection = new RTCPeerConnection(this.rtcConfig);
            var iceHandler = this.onICECandidate.bind(this);
            this.connection.onicecandidate = iceHandler;
            var stateHandler = this.onStateChange.bind(this);
            this.connection.oniceconnectionstatechange = stateHandler;
            var trackHandler = this.onRemoteTrack.bind(this);
            this.connection.addEventListener("track", trackHandler);
            this.connection.addEventListener("addstream", trackHandler);
            // Add audio stream
            var addStreamFunc = this.connection.addStream;
            if (addStreamFunc != null) {
                addStreamFunc.call(this.connection, myStream);
            }
            else {
                myStream.getTracks().forEach(function (t) {
                    _this.connection.addTrack(t, myStream);
                });
            }
        }
        /** Send offer to remote party */
        RTCAudioConnection.prototype.sendOffer = function () {
            var _this = this;
            this.connection.createOffer(this.offerOption)
                .then(function (sdp) {
                // Local descriptor created
                logMessage("Offer created!");
                _this.connection.setLocalDescription(sdp);
                // Send offer message
                var offerMsg = {
                    type: MSG_OFFER,
                    data: sdp,
                    target: _this.remoteId
                };
                sendMessage(offerMsg);
            })
                .catch(function () { return logMessage("Failed to create offer!"); });
        };
        /**
         * Set received answer
         * @param answerData Answer SDP
         */
        RTCAudioConnection.prototype.setRemoteAnswer = function (answerData) {
            var remoteSdp = new RTCSessionDescription(answerData);
            this.connection.setRemoteDescription(remoteSdp)
                .then(function () { return logMessage("Remote description set!"); })
                .catch(function () { return logMessage("Remote description set error!"); });
        };
        /**
         * Set new ICE candidate data
         * @param iceData ICE data
         */
        RTCAudioConnection.prototype.setNewICECandidate = function (iceData) {
            this.connection.addIceCandidate(new RTCIceCandidate(iceData));
        };
        /**
         * Set remote offer data and send answer
         * @param offerData Remote offer
         */
        RTCAudioConnection.prototype.setRemoteOffer = function (offerData) {
            var _this = this;
            var remoteDesc = new RTCSessionDescription(offerData);
            this.connection.setRemoteDescription(remoteDesc)
                .then(function () { return logMessage("Remote description set!"); })
                .catch(function (e) { return logMessage("Remote descriptor error: " + e); });
            this.connection.createAnswer(this.offerOption)
                .then(function (answerSdp) {
                // Answer sdp created
                logMessage("Answer created!");
                _this.connection.setLocalDescription(answerSdp);
                var answerMessage = {
                    type: MSG_ANSWER,
                    data: answerSdp,
                    target: _this.remoteId
                };
                sendMessage(answerMessage);
            })
                .catch(function (e) { return logMessage("Answer error: " + e); });
        };
        /** Connection state changed */
        RTCAudioConnection.prototype.onStateChange = function (e) {
            logMessage("New state: " + this.connection.signalingState);
        };
        /** Got remote track */
        RTCAudioConnection.prototype.onRemoteTrack = function (e) {
            var peerAudio = $("<audio controls>").attr("id", this.remoteId);
            var jControlBlock = $("<p class=peer-audio>")
                .append($("<h4>").text(this.remoteId))
                .append(peerAudio);
            $("#audioControls").append(jControlBlock);
            this.remoteAudioElem = peerAudio.get(0);
            if (e.stream) {
                this.remoteAudioElem.srcObject = e.stream;
            }
            else {
                this.remoteAudioElem.srcObject = e.streams[0];
            }
            this.remoteAudioElem.play();
        };
        /** On ICE candidate */
        RTCAudioConnection.prototype.onICECandidate = function (e) {
            var iceMsg = {
                type: MSG_ICE,
                data: e.candidate,
                target: this.remoteId
            };
            sendMessage(iceMsg);
        };
        return RTCAudioConnection;
    }());
    var socket;
    var labels;
    // Local audio output
    var myAudioElem;
    // Local audio stream
    var localStream;
    // All connected pairs
    var connectionPairs;
    /**
     * Add log message
     * @param text Message text
     */
    function logMessage(text) {
        var msgElem = $("<div>").text(text);
        $("#messages").append(msgElem);
    }
    /**
     * Get pair by remote client's id
     * @param remoteId Remote client identifier
     */
    function getPairById(remoteId) {
        var found = connectionPairs.filter(function (p) { return p.remoteId == remoteId; });
        return found.length > 0 ? found[0] : null;
    }
    /**
     * Create connections with remote clients
     * @param remoteIds Remote clients' id
     */
    function createConnectionPairs(remoteIds) {
        for (var _i = 0, remoteIds_1 = remoteIds; _i < remoteIds_1.length; _i++) {
            var id = remoteIds_1[_i];
            var newConnection = new RTCAudioConnection(id, localStream);
            newConnection.sendOffer();
            connectionPairs.push(newConnection);
        }
    }
    /**
     * Got answer to sent offer
     * @param remoteId Remote peer's id
     * @param answer Answer SDP
     */
    function gotRemoteAnswer(remoteId, answer) {
        var pair = getPairById(remoteId);
        pair.setRemoteAnswer(answer);
    }
    /**
     * Got ICE candidate data
     * @param remoteId Remote peer's id
     * @param iceData New ICE candidate
     */
    function gotICECandidate(remoteId, iceData) {
        var pair = getPairById(remoteId);
        if (pair != null) {
            pair.setNewICECandidate(iceData);
        }
    }
    /**
     * Received connection offer
     * @param remoteId Remote peer's id
     * @param offerData Connection offer
     */
    function getOfferFromPeer(remoteId, offerData) {
        var newConnection = new RTCAudioConnection(remoteId, localStream);
        newConnection.setRemoteOffer(offerData);
        connectionPairs.push(newConnection);
    }
    // Process signalling server message
    function processMessage(msg) {
        var type = msg["Type"];
        var payload = msg["Data"];
        var remoteId = msg["Target"];
        if (type == MSG_CLIENTS) {
            var readyIds = payload;
            if (readyIds.length > 0) {
                createConnectionPairs(readyIds);
            }
        }
        else if (type == MSG_OFFER) {
            getOfferFromPeer(remoteId, payload);
        }
        else if (type == MSG_ANSWER) {
            gotRemoteAnswer(remoteId, payload);
        }
        else if (type == MSG_ICE) {
            gotICECandidate(remoteId, payload);
        }
    }
    // Send message to signalling server
    function sendMessage(msg) {
        socket.send(JSON.stringify(msg));
    }
    /**
     * Got local audio stream
     * @param audioStream Local audio stream
     */
    function gotLocalStream(audioStream) {
        localStream = audioStream;
        // Listen local stream
        myAudioElem.srcObject = localStream;
        myAudioElem.play();
        // Show volume control
        $(myAudioElem).parents(".my-audio").removeClass("hidden");
        // Send ready message
        var initMsg = {
            type: MSG_INIT,
            data: null
        };
        sendMessage(initMsg);
    }
    /** Request client audio stream */
    function requestMediaStream() {
        navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: 12000 },
            video: false
        }).then(gotLocalStream)
            .catch(function () { return logMessage("Cannot access microphone!"); });
    }
    // On connection
    function socketConnected() {
        logMessage("Connected to server!");
        labels.eq(0).removeClass("hidden");
        setTimeout(requestMediaStream, 1000);
    }
    // On network error
    function socketError() {
        logMessage("Connection error!");
        labels.eq(1).removeClass("hidden");
    }
    // On receive data from server
    function socketMessage(e) {
        var msg = JSON.parse(e.data);
        processMessage(msg);
    }
    /** Connect audio processing server */
    function connectSignallingServer() {
        var serverAddress = $("#wsAddress").val();
        socket = new WebSocket(serverAddress);
        socket.onopen = socketConnected;
        socket.onerror = socketError;
        socket.onmessage = socketMessage;
    }
    /** Initialize page UI */
    function initializeUi() {
        labels = $("h2 .label");
        myAudioElem = $("#myAudio")[0];
        $(".controls .btn-default").on("click", function () {
            $(this).attr("disabled", "disabled");
            connectSignallingServer();
        });
    }
    /** Initialize RTC peer */
    function initialize() {
        connectionPairs = [];
        initializeUi();
    }
    RTCTest.initialize = initialize;
})(RTCTest || (RTCTest = {}));
$(function () { return RTCTest.initialize(); });
//# sourceMappingURL=rtc_test.js.map