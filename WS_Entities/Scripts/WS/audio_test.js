var AudioTest;
(function (AudioTest) {
    // Audio server connect URL
    var AUDIO_ENDPOINT = "ws://localhost:5678/wsaudio/";
    var SAMPLE_SIZE = 4096;
    var inAudioElem;
    var inputAudio;
    var outputAudio;
    var playBuffers = [];
    var socket;
    var time = 0;
    var labels;
    // Prepare audio processor
    function trackStarted() {
        inputAudio = new AudioContext();
        var elemSrc = inputAudio.createMediaElementSource(inAudioElem);
        var processor = inputAudio.createScriptProcessor(SAMPLE_SIZE, 1, 1);
        elemSrc.connect(processor);
        processor.onaudioprocess = function (e) {
            var buffer = e.inputBuffer.getChannelData(0);
            socket.send(buffer);
        };
    }
    // Prepare microphone for capturing
    function initializeMicrophone() {
        inputAudio = new AudioContext();
        var request = {
            audio: {
                sampleRate: 16000
            },
            video: false
        };
        navigator.mozGetUserMedia(request, function (stream) {
            var elemSrc = inputAudio.createMediaStreamSource(stream);
            var processor = inputAudio.createScriptProcessor(SAMPLE_SIZE, 1, 1);
            elemSrc.connect(processor);
            processor.onaudioprocess = function (e) {
                var buffer = e.inputBuffer.getChannelData(0);
                socket.send(buffer);
            };
        }, function () { return console.log("Cannot access microphone!"); });
    }
    // Received sample from server
    function sampleReceived(buffer) {
        var receivedData = new Float32Array(buffer);
        var rcvSize = receivedData.length;
        var inpSR = inputAudio.sampleRate;
        var sampleBuffer = outputAudio.createBuffer(1, rcvSize, inpSR);
        var channelData = sampleBuffer.getChannelData(0);
        for (var i = 0; i < channelData.length; i++) {
            channelData[i] = receivedData[i];
        }
        var outputSource = outputAudio.createBufferSource();
        outputSource.buffer = sampleBuffer;
        outputSource.connect(outputAudio.destination);
        outputSource.start();
    }
    function socketConnected() {
        console.log("Connected to server!");
        labels.eq(0).removeClass("hidden");
    }
    function socketError() {
        console.log("Connection error!");
        labels.eq(1).removeClass("hidden");
    }
    // On receive data from server
    function socketMessage(e) {
        var reader = new FileReader();
        reader.onload = function () { return sampleReceived(reader.result); };
        reader.readAsArrayBuffer(e.data);
    }
    // Connect audio processing server
    function connectAudioServer() {
        socket = new WebSocket(AUDIO_ENDPOINT);
        socket.onopen = socketConnected;
        socket.onerror = socketError;
        socket.onmessage = socketMessage;
    }
    // Initialize audio buffer for remote data
    function initializeRemoteAudio() {
        outputAudio = new AudioContext();
    }
    // Initialize page UI
    function initializeUi() {
        labels = $("h2 .label");
        $("#chooseSource button").click(function (e) {
            var btnIdx = $(e.target).index();
            var sources = $(".src");
            sources.eq(btnIdx).removeClass("hidden");
            if (btnIdx == 1) {
                initializeMicrophone();
            }
            $("#chooseSource").addClass("hidden");
        });
    }
    // Initialize
    function initialize() {
        inAudioElem = $("#testAudio").get(0);
        inAudioElem.onplay = trackStarted;
        initializeUi();
        initializeRemoteAudio();
        connectAudioServer();
    }
    AudioTest.initialize = initialize;
})(AudioTest || (AudioTest = {}));
$(function () { return AudioTest.initialize(); });
//# sourceMappingURL=audio_test.js.map