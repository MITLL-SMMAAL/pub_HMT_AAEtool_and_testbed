document.addEventListener("DOMContentLoaded", function () {
  const hostAddr = "http://localhost:3000/chat"; // address of server that will sent chats over to chatbot

  const timelineFile = "minecraft_gameplay_events.json";
  const contextFile = "minecraft_context.txt";

  const playPauseBtn = $("#playPauseBtn")[0];
  const rewindBtn = $("#rewindBtn")[0];

  const chatHistoryBox = $("#chat-history")[0];
  const chatInputBox = $("#chat-input-box")[0];

  var video1Duration = 0;
  var video2Duration = 0;

  let videosReady = [false, false];

  // Get canvas and context
  const canvas = $("#video-timeline")[0];
  const ctx = canvas.getContext("2d");
  let isDragging = false; // flag for whether user is dragging mouse on canvas

  let chatHistory = [];

  let timelineDescription = "";
  let timelineDescriptionFiletype = "other"; // should be json, txt, or other
  let eventData = "";
  let contextDescription = "";

  // Array to store event positions and data
  const eventPositions = [];

  // Tooltip element
  const tooltip = document.createElement("div");
  tooltip.style.position = "absolute";
  tooltip.style.backgroundColor = "#f0f0f0";
  tooltip.style.border = "1px solid #ccc";
  tooltip.style.padding = "5px";
  tooltip.style.borderRadius = "5px";
  tooltip.style.display = "none";
  document.body.appendChild(tooltip);

  // Load selected video file into video element
  function loadVideo(input, video, source) {
    const file = input.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      console.log("Loading " + file.name);
      // console.log(url);
      source.setAttribute("src", url); // Set the src attribute
      video.load(); // Load the new video
    }
  }

  async function loadContextFile() {
    try {
      const response = await fetch(contextFile);
      if (!response.ok) throw new Error("Failed to load context file");
      const textContent = await response.text();

      console.log("Text File Content:", textContent);
      contextDescription = textContent;
      initializeChatFromLoadedExplanation();
    } catch (error) {
      console.error(error);
    }
  }

  async function loadTimelineFile() {
    try {
      const response = await fetch(timelineFile);
      if (!response.ok) throw new Error("Failed to load timeline file");
      const textContent = await response.text();

      console.log("Text File Content:", textContent);
      timelineDescription = textContent;
      initializeChatFromLoadedExplanation();

      eventData = JSON.parse(timelineDescription);
      loadEvents();
    } catch (error) {
      console.error(error);
    }
  }

  // Function to sync video play/pause
  function syncPlayPause() {
    if (videosReady[0] && videosReady[1]) {
      if ($("#video1")[0].paused && $("#video2")[0].paused) {
        playPauseBtn.textContent = " ❚❚ ";
        // Check if videos are the same length (within 1s)

        // TODO - currently severely relaxing the duration matching requirement
        if (Math.abs(video1Duration - video2Duration) > 30) {
          alert("Video lengths are > 1 second different.");
        }
        $("#video1")[0].play();
        $("#video2")[0].play();
      } else {
        playPauseBtn.textContent = " ► ";
        $("#video1")[0].pause();
        $("#video2")[0].pause();
      }
    } else {
      alert("One or both videos not loaded.");
    }
  }

  // Function to reset the play/pause button when the video is done playing
  function resetPlayPause() {
    playPauseBtn.textContent = " ► ";
    $("#video1")[0].pause();
    $("#video2")[0].pause();
  }

  // Function to rewind both videos by 10 seconds
  function rewindVideos() {
    $("#video1")[0].currentTime = Math.max(0, $("#video1")[0].currentTime - 10);
    $("#video2")[0].currentTime = Math.max(0, $("#video2")[0].currentTime - 10);
  }

  // Event listeners for buttons
  playPauseBtn.addEventListener("click", syncPlayPause);
  playPauseBtn.addEventListener("ended", resetPlayPause);
  rewindBtn.addEventListener("click", rewindVideos);

  // Function to sync video currentTime and get explanations
  function syncTime(event) {
    const otherVideo =
      event.target === $("#video1")[0] ? $("#video2")[0] : $("#video1")[0];
    if (
      Math.abs($("#video1")[0].currentTime - $("#video2")[0].currentTime) > 0.2
    ) {
      otherVideo.currentTime = event.target.currentTime;
    }
    updateTimestamp();
    // updateExplanation();
  }

  // Function to update the timestamp display
  function updateTimestamp() {
    $("#video1-time")[0].textContent = formatTime($("#video1")[0].currentTime);
    // video2Time.textContent = formatTime(video2.currentTime);
  }

  // Helper function to format time as MM:SS
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  }

  function initializeCanvas() {
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill the canvas with a light gray rectangle (solid background)
    ctx.strokeStyle = "#D3D3D3"; // Light gray color
    ctx.fillStyle = "#D3D3D3";
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 15);
    ctx.fill();
    ctx.stroke();
  }

  function drawCanvas() {
    const videoDuration = $("#video1")[0].duration || 1; // Avoid division by zero
    const videoCurrentTime = $("#video1")[0].currentTime || 0;
    // console.log($("#video1")[0].duration + ", " + $("#video2")[0].duration);
    $("#video1-duration")[0].textContent = formatTime($("#video1")[0].duration);
    // Clear and redraw the background
    initializeCanvas();

    if (eventData.length > 0) {
      // Draw blue circles for events and store their positions
      eventPositions.length = 0; // Clear previous positions
      eventData.forEach((event) => {
        const timestamp = event.timestamp;
        const percentPlayed = (timestamp / videoDuration) * 100;
        const circleX = (percentPlayed / 100) * canvas.width;

        // Draw the blue circle
        ctx.beginPath();
        ctx.arc(circleX, canvas.height / 2, 5, 0, 2 * Math.PI, false);
        ctx.fillStyle = "blue";
        ctx.fill();

        // Store the event position for hover detection
        eventPositions.push({
          x: circleX,
          y: canvas.height / 2,
          radius: 5,
          data: event,
        });
      });
    }

    // Draw the vertical red line for video progress
    const percentPlayed = (videoCurrentTime / videoDuration) * 100;
    const lineX = (percentPlayed / 100) * canvas.width;
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lineX, 0);
    ctx.lineTo(lineX, canvas.height);
    ctx.stroke();
  }

  // Function to load and process events from the JSON file
  function loadEvents() {
    // Store the loaded JSON data into eventData
    // eventData = JSON.parse(timelineDescription);     // should already be loaded before
    drawCanvas(); // Redraw the canvas with the updated events

    const ctx = canvas.getContext("2d");
    const videoDuration = $("#video1")[0].duration;

    // Loop through events and draw blue circles
    eventData.forEach((event) => {
      const timestamp = event.timestamp;
      const percentPlayed = (timestamp / videoDuration) * 100;
      const circleX = (percentPlayed / 100) * canvas.width;

      // Draw the blue circle
      ctx.beginPath();
      ctx.arc(circleX, canvas.height / 2, 5, 0, 2 * Math.PI, false); // Circle size: radius 5
      ctx.fillStyle = "blue";
      ctx.fill();
    });
  }

  // Handle click event
  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect(); // Get canvas position
    const mouseX = event.clientX - rect.left; // Mouse X position relative to canvas
    const canvasWidth = canvas.width;

    // Calculate clicked time in the video
    const clickedTime = (mouseX / canvasWidth) * video1Duration;

    // Update video playback time
    $("#video1")[0].currentTime = clickedTime;
    $("#video2")[0].currentTime = clickedTime;
  });

  // Handle mouse down event for dragging
  canvas.addEventListener("mousedown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;

    // Check if the click is close to the red line
    const redLineX =
      ($("#video1")[0].currentTime / $("#video1")[0].duration) * canvas.width;
    if (mouseX >= redLineX - 10 && mouseX <= redLineX + 10) {
      // Adjust tolerance as needed
      isDragging = true; // Start dragging
    }
  });

  // Handle mouse move event for dragging
  canvas.addEventListener("mousemove", (event) => {
    if (isDragging) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const canvasWidth = canvas.width;
      const video1Duration = $("#video1")[0].duration; // Get duration using jQuery

      // Calculate new video time based on mouse position
      const newTime = (mouseX / canvasWidth) * video1Duration;

      // Update playback time for both videos using jQuery
      $("#video1")[0].currentTime = newTime;
      $("#video2")[0].currentTime = newTime;

      // Update red line position
      drawTimeline(); // Redraw the timeline with the updated position
    }
  });

  // Handle mouse up event
  canvas.addEventListener("mouseup", () => {
    isDragging = false; // Stop dragging
  });

  // Mouse move event for hover detection
  canvas.addEventListener("mousemove", function (e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    let isHovering = false;

    // Check if the mouse is hovering over any event circle
    eventPositions.forEach((event) => {
      const dist = Math.sqrt((mouseX - event.x) ** 2 + (mouseY - event.y) ** 2);
      if (dist < event.radius) {
        // Show tooltip with event data
        tooltip.style.display = "block";
        tooltip.style.left = `${e.pageX + 10}px`;
        tooltip.style.top = `${e.pageY + 10}px`;
        tooltip.innerHTML = `<strong>Timestamp:</strong> ${event.data.timestamp}s<br>
                                   <strong>Inferred Human Action:</strong> ${event.data.actions.human.inferred_action}<br>
                                   <strong>Robot Action:</strong> ${event.data.actions.robot.action}`;
        isHovering = true;
        // console.log(
        //   "found hover at NEAR CIRCLE" +
        //     String(event.x) +
        //     ", " +
        //     String(event.y)
        // );
      }
      // console.log(
      //   "found hover at not near circle " +
      //     String(event.x) +
      //     ", " +
      //     String(event.y)
      // );
    });

    // Hide tooltip if not hovering over any event circle
    if (!isHovering) {
      tooltip.style.display = "none";
    }
  });

  // Function to update the vertical line based on video progress
  function updateTimeline() {
    drawCanvas(); // draw the red line and blue circles
  }

  // Add event listeners
  for (let i = 1; i < 3; i++) {
    let videoName = "#video" + String(i);

    // Event listeners to check if videos can play
    $(videoName)[0].addEventListener("canplay", () => {
      videosReady[i - 1] = true;
    });

    // Event listeners for file metadata
    $(videoName)[0].addEventListener("loadedmetadata", () => {
      const duration = $(videoName)[0].duration;
      video1Duration = duration;
      if (i === 1) {
        $("#video1-duration")[0].textContent = formatTime(duration);
        video1Duration = duration;
      } else {
        video2Duration = duration;
      }
    });

    // Event listeners for video time updates
    $(videoName)[0].addEventListener("timeupdate", syncTime);

    // event listeners for canvas timeline
    $(videoName)[0].addEventListener("timeupdate", updateTimeline);
  }

  // Placeholder for getting explanations based on time
  function getExplanation(seconds) {
    if (seconds < 3) {
      return "(Placeholder) The human is mining ore and the agent is chopping wood.";
    } else if (seconds < 8) {
      return "(Placeholder) The human is mining ore and the agent is making a pickaxe.";
    } else {
      return "(Placeholder) The human is building a house and the agent is chopping wood.";
    }
  }

  function getAllExplanations() {
    let explanationArr = [];
    for (let time = 0; time < 11; time++) {
      explanationArr.push({
        role: "system",
        content: "At time " + time + " seconds: " + getExplanation(time),
      });
    }
    return explanationArr;
  }

  // Send message to server
  async function sendMessage(messages) {
    try {
      const response = await fetch(hostAddr, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      });
      const data = await response.json();
      if (response.ok) {
        addBotMessage(data.response);
      } else {
        console.error("Error:", data.error);
        addBotMessage(
          "Sorry, there was an error processing your request. Did you remember to start the server?"
        );
      }
    } catch (error) {
      console.error("Error:", error);
      addBotMessage(
        "Sorry, there was an error connecting to the server. Did you remember to start the server?"
      );
    }
  }

  function addMessage(className, speakerName, message) {
    // create chat element for display if the class includes the tag chat-entry
    if (className.includes("chat-entry")) {
      var chatEntry = document.createElement("div");
      chatEntry.className = className;
      chatEntry.innerHTML = marked.parse(`**${speakerName}:** ${message}`);

      // append the new chat entry to the chat history
      chatHistoryBox.appendChild(chatEntry);
    }
    chatHistory.push({ role: speakerName.toLowerCase(), content: message });
    return chatEntry;
  }

  function addUserMessage() {
    if (chatInputBox.value.trim() !== "") {
      addMessage("chat-entry user-entry", "User", chatInputBox.value);
      addMessage(
        "system-entry",
        "System",
        "The video is currently at time " +
          String(Math.round($("#video1")[0].currentTime)) +
          " seconds"
      );
      sendMessage(chatHistory); // send the entire chat history to the server
      chatInputBox.value = ""; // clear the input box
      chatHistoryBox.scrollTop = chatHistoryBox.scrollHeight; // scroll to the bottom of the chat history
    }
  }

  function addBotMessage(message) {
    addMessage("chat-entry bot-entry", "Bot", message);
    chatHistoryBox.scrollTop = chatHistoryBox.scrollHeight;
  }

  // Function to initialize chat history with instructions
  function initializeChat() {
    // system instructions
    addMessage(
      "system-entry",
      "System",
      `This is conversation between a user and an assistant who are looking over videos of a human and an agent working \
            together in a game and and trying to understand what is going on. You will first receive a timeline of the events \
            in the videos, followed by the chat history. Keep your responses to the information given and do not try to extrapolate.`
    );

    // Video explanations
    addMessage(
      "bot-entry",
      "Bot",
      "Video description: " +
        getAllExplanations()
          .map((msg, index) => {
            return msg.content;
          })
          .join("\n")
    );
  }

  // Function to initialize chat history with instructions
  function initializeChatFromLoadedExplanation() {
    chatHistory = []; // clear the chat history

    addMessage(
      "system-entry",
      "System",
      "This is conversation between a user and an assistant who are looking over videos of a human and an agent working\
            together. You will first some background information about the scenario, followed by the chat history. Keep your\
            responses to the information given and do not try to extrapolate"
    );

    // Add description of game context if it was uploaded
    if (contextDescription.trim() !== "") {
      // system instructions
      addMessage(
        "system-entry",
        "System",
        "Game Context: " + contextDescription
      );
    } else {
      addMessage("system-entry", "System", "No game context provided.");
    }

    // Add description of timeline if it was uploaded
    console.log(timelineDescription);
    if (timelineDescription.trim() !== "") {
      addMessage(
        "system-entry",
        "System",
        "Timeline of events: " + timelineDescription
      );
    } else {
      addMessage("system-entry", "System", "No game timeline provided.");
    }

    console.log(chatHistory);
  }

  // handle chat entry if user presses Enter key
  function handleChatInput(event) {
    if (event.key === "Enter") {
      addUserMessage();
    }
  }

  chatInputBox.addEventListener("keydown", handleChatInput);
  $("#enterTextBtn")[0].addEventListener("click", addUserMessage);

  loadContextFile();
  loadTimelineFile();
  initializeCanvas();
  initializeChat();
});
