// WebRTC test
declare var $: JQueryStatic;

module RTCTest {

    // Signalling server messages
    const MSG_INIT: string = "init";
    const MSG_CLIENTS: string = "ready_clients";
    const MSG_OFFER: string = "offer";
    const MSG_ANSWER: string = "answer";
    const MSG_ICE: string = "ice";
    
    /** P2P audio connection */
    class RTCAudioConnection {

        // Peer offer options
        private offerOption: RTCOfferOptions = {
            offerToReceiveAudio: true
        };

        // WebRTC configuration
        private rtcConfig: RTCConfiguration = {
            iceServers: []
        };

        // P2P connection
        private connection: RTCPeerConnection;

        // Remote peer audio output
        private remoteAudioElem: HTMLAudioElement;

        /** Send offer to remote party */
        public sendOffer(): void {
            this.connection.createOffer(this.offerOption)
                .then((sdp: RTCSessionDescription) => {
                    // Local descriptor created
                    logMessage("Offer created!");
                    this.connection.setLocalDescription(sdp);

                    // Send offer message
                    let offerMsg = {
                        type: MSG_OFFER,
                        data: sdp,
                        target: this.remoteId
                    };
                    sendMessage(offerMsg);
                })
                .catch(() => logMessage("Failed to create offer!"));
        }

        /**
         * Set received answer
         * @param answerData Answer SDP
         */
        public setRemoteAnswer(answerData: any): void {
            let remoteSdp = new RTCSessionDescription(answerData);
            this.connection.setRemoteDescription(remoteSdp)
                .then(() => logMessage("Remote description set!"))
                .catch(() => logMessage("Remote description set error!"));
        }

        /**
         * Set new ICE candidate data
         * @param iceData ICE data
         */
        public setNewICECandidate(iceData: any): void {
            this.connection.addIceCandidate(new RTCIceCandidate(iceData));
        }

        /**
         * Set remote offer data and send answer
         * @param offerData Remote offer
         */
        public setRemoteOffer(offerData: any): void {
            let remoteDesc = new RTCSessionDescription(offerData);
            this.connection.setRemoteDescription(remoteDesc)
                .then(() => logMessage("Remote description set!"))
                .catch(e => logMessage(`Remote descriptor error: ${e}`));
            this.connection.createAnswer(this.offerOption)
                .then(answerSdp => {
                    // Answer sdp created
                    logMessage("Answer created!");
                    this.connection.setLocalDescription(answerSdp);

                    let answerMessage = {
                        type: MSG_ANSWER,
                        data: answerSdp,
                        target: this.remoteId
                    };
                    sendMessage(answerMessage);
                })
                .catch(e => logMessage(`Answer error: ${e}`));
        }

        /** Connection state changed */
        private onStateChange(e: Event): void {
            logMessage(`New state: ${this.connection.signalingState}`);
        }

        /** Got remote track */
        private onRemoteTrack(e: any): void {
            const peerAudio = $("<audio controls>").attr("id", this.remoteId);
            const jControlBlock = $("<p class=peer-audio>")
                .append($("<h4>").text(this.remoteId))
                .append(peerAudio);
            $("#audioControls").append(jControlBlock);

            this.remoteAudioElem = <HTMLAudioElement>peerAudio.get(0);

            if (e.stream) {
                this.remoteAudioElem.srcObject = e.stream;
            } else {
                this.remoteAudioElem.srcObject = e.streams[0];
            }

            this.remoteAudioElem.play();
        }

        /** On ICE candidate */
        private onICECandidate(e: RTCPeerConnectionIceEvent): void {
            let iceMsg = {
                type: MSG_ICE,
                data: e.candidate,
                target: this.remoteId
            };
            sendMessage(iceMsg);
        }

        constructor(public remoteId: string, myStream: MediaStream) {
            // Create connection
            this.connection = new RTCPeerConnection(this.rtcConfig);

            let iceHandler = this.onICECandidate.bind(this);
            this.connection.onicecandidate = iceHandler;
            let stateHandler = this.onStateChange.bind(this);
            this.connection.oniceconnectionstatechange = stateHandler;
            let trackHandler = this.onRemoteTrack.bind(this);
            this.connection.addEventListener("track", trackHandler);
            this.connection.addEventListener("addstream", trackHandler);

            // Add audio stream
            let addStreamFunc = (<any>this.connection).addStream;

            if (addStreamFunc != null) {
                addStreamFunc.call(this.connection, myStream);
            } else {
                myStream.getTracks().forEach(t => {
                    this.connection.addTrack(t, myStream)
                });
            }
        }
    }

    var socket: WebSocket;

    var labels: any;

    // Local audio output
    var myAudioElem: HTMLAudioElement;

    // Local audio stream
    var localStream: MediaStream;

    // All connected pairs
    var connectionPairs: Array<RTCAudioConnection>;

    /**
     * Add log message
     * @param text Message text
     */
    function logMessage(text: string): void {
        let msgElem = $("<div>").text(text);
        $("#messages").append(msgElem);
    }

    /**
     * Get pair by remote client's id
     * @param remoteId Remote client identifier
     */
    function getPairById(remoteId: string): RTCAudioConnection {
        let found = connectionPairs.filter(p => p.remoteId == remoteId);
        return found.length > 0 ? found[0] : null;
    }

    /**
     * Create connections with remote clients
     * @param remoteIds Remote clients' id
     */
    function createConnectionPairs(remoteIds: string[]): void {
        for (let id of remoteIds) {
            let newConnection = new RTCAudioConnection(id, localStream);
            newConnection.sendOffer();
            connectionPairs.push(newConnection);
        }
    }

    /**
     * Got answer to sent offer
     * @param remoteId Remote peer's id
     * @param answer Answer SDP
     */
    function gotRemoteAnswer(remoteId: string, answer: any): void {
        let pair = getPairById(remoteId);
        pair.setRemoteAnswer(answer);
    }

    /**
     * Got ICE candidate data
     * @param remoteId Remote peer's id
     * @param iceData New ICE candidate
     */
    function gotICECandidate(remoteId: string, iceData: any): void {
        let pair = getPairById(remoteId);
        if (pair != null) {
            pair.setNewICECandidate(iceData);
        }
    }

    /**
     * Received connection offer
     * @param remoteId Remote peer's id
     * @param offerData Connection offer
     */
    function getOfferFromPeer(remoteId: string, offerData: any): void {
        var newConnection = new RTCAudioConnection(remoteId, localStream);
        newConnection.setRemoteOffer(offerData);
        connectionPairs.push(newConnection);
    }

    // Process signalling server message
    function processMessage(msg: any): void {
        let type: string = msg["Type"];
        let payload = msg["Data"];
        let remoteId = msg["Target"];

        if (type == MSG_CLIENTS) {
            let readyIds = <string[]>payload;
            if (readyIds.length > 0) {
                createConnectionPairs(readyIds);
            }
        } else if (type == MSG_OFFER) {
            getOfferFromPeer(remoteId, payload);
        } else if (type == MSG_ANSWER) {
            gotRemoteAnswer(remoteId, payload);
        } else if (type == MSG_ICE) {
            gotICECandidate(remoteId, payload);
        }
    }

    // Send message to signalling server
    function sendMessage(msg: any): void {
        socket.send(JSON.stringify(msg));
    }

    /**
     * Got local audio stream
     * @param audioStream Local audio stream
     */
    function gotLocalStream(audioStream: MediaStream) {
        localStream = audioStream;
        // Listen local stream
        myAudioElem.srcObject = localStream;
        myAudioElem.play();

        // Show volume control
        $(myAudioElem).parents(".my-audio").removeClass("hidden");

        // Send ready message
        let initMsg = {
            type: MSG_INIT,
            data: null
        };
        sendMessage(initMsg);
    }

    /** Request client audio stream */
    function requestMediaStream(): void {
        navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: 12000 },
            video: false
        }).then(gotLocalStream)
          .catch(() => logMessage("Cannot access microphone!"));
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
    function socketMessage(e: MessageEvent) {
        var msg = JSON.parse(e.data);
        processMessage(msg);
    }

    /** Connect audio processing server */
    function connectSignallingServer() {
        const serverAddress = $("#wsAddress").val();
        socket = new WebSocket(serverAddress);

        socket.onopen = socketConnected;
        socket.onerror = socketError;
        socket.onmessage = socketMessage;
    }

    /** Initialize page UI */
    function initializeUi() {
        labels = $("h2 .label");
        myAudioElem = <HTMLAudioElement>$("#myAudio")[0];

        $(".controls .btn-default").on("click", function() {
            $(this).attr("disabled", "disabled");
            connectSignallingServer();
        });
    }

    /** Initialize RTC peer */
    export function initialize() {
        connectionPairs = [];
        initializeUi();
    }
}

$(() => RTCTest.initialize());