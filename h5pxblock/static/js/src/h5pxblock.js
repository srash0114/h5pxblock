/* Javascript for H5PPlayerXBlock. */
function H5PPlayerXBlock(runtime, element, args) {
  // Initialize queue if not exists
  if (!window.H5PBlocksQueue) {
    window.H5PBlocksQueue = [];
    window.H5PBlocksQueueProcessing = false;
    console.log('Initialized H5PBlocksQueue');
  }
  
  console.log('Adding block to queue:', { runtime, element, args });
  window.H5PBlocksQueue.push({runtime, element, args});
  
  if (!window.H5PBlocksQueueProcessing) {
    console.log('Starting to process H5P blocks queue');
    processNextBlock();
  }
  
  // Process blocks one at a time
  async function processNextBlock() {
    window.H5PBlocksQueueProcessing = true;
    console.log('Processing next block, queue length:', window.H5PBlocksQueue.length);
    
    if (window.H5PBlocksQueue.length > 0) {
      const blockData = window.H5PBlocksQueue.shift();
      console.log('Processing block:', blockData);
      await initH5PBlock(blockData.runtime, blockData.element, blockData.args);
      processNextBlock();
    } else {
      window.H5PBlocksQueueProcessing = false;
      console.log('Queue processing completed');
    }
  }
  
  async function initH5PBlock(runtime, element, args) {
    console.log('Initializing H5P block with args:', args);
    if (typeof require === "function") {
      console.log('Using require to load H5PStandalone');
      return new Promise((resolve) => {
        require(["h5p"], function (H5PStandalone) {
          console.log('H5PStandalone loaded via require');
          initWithH5P(H5PStandalone, "cms", runtime, element, args)
            .then(resolve);
        });
      });
    } else {
      console.log('Loading H5PStandalone via getScript');
      await loadJS();
      return initWithH5P(window.H5PStandalone, "lms", runtime, element, args);
    }
  }
  
  async function initWithH5P(H5PStandalone, service, runtime, element, args) {
    const contentUserDataUrl = runtime.handlerUrl(
      element,
      "user_interaction_data"
    );
    const contentxResultSaveUrl = runtime.handlerUrl(element, "result_handler");
    console.log('Handler URLs:', { contentUserDataUrl, contentxResultSaveUrl });

    const h5pel = document.getElementById("h5p-" + args.player_id);
    if (h5pel && $(h5pel).children(".h5p-iframe-wrapper").length == 0) {
      const userObj = { name: args.user_full_name, mail: args.user_email };
      const options = {
        h5pJsonPath: args.h5pJsonPath,
        frameJs:
          "https://cdn.jsdelivr.net/npm/h5p-standalone@3.7.0/dist/frame.bundle.js",
        frameCss:
          "https://cdn.jsdelivr.net/npm/h5p-standalone@3.7.0/dist/styles/h5p.css",
        frame: args.frame,
        copyright: args.copyright,
        icon: args.icon,
        fullScreen: args.fullScreen,
        user: userObj,
        saveFreq: args.saveFreq,
        customJs: args.customJsPath,
        contentUserData: [
          {
            state: args.userData,
          },
        ],
        ajax: {
          contentUserDataUrl: contentUserDataUrl,
        },
      };
      console.log('H5P options:', options);

      try {
        console.log('Initializing H5PStandalone for player_id:', args.player_id);
        await new H5PStandalone.H5P(h5pel, options);
        console.log('H5P content initialized successfully');
        $(h5pel).siblings(".spinner-container").find(".spinner-border").hide();
        $(h5pel).show();

        H5P.externalDispatcher.on("xAPI", (event) => {
          console.log('xAPI event triggered:', event);
          let hasStatement = event && event.data && event.data.statement;
          if (!hasStatement) {
            console.log('No valid xAPI statement found');
            return;
          }

          let statement = event.data.statement;
          console.log('xAPI statement:', statement);
          let validVerb =
            statement.verb &&
            statement.verb.display &&
            statement.verb.display["en-US"];
          if (!validVerb) {
            console.log('No valid verb in xAPI statement');
            return;
          }

          let isCompleted =
            statement.verb.display["en-US"] === "answered" ||
            statement.verb.display["en-US"] === "completed" ||
            statement.verb.display["en-US"] === "consumed";
          let isChild =
            statement.context &&
            statement.context.contextActivities &&
            statement.context.contextActivities.parent &&
            statement.context.contextActivities.parent[0] &&
            statement.context.contextActivities.parent[0].id;

          console.log('xAPI event details:', { isCompleted, isChild });

          // Store only completed root events.
          if (isCompleted && !isChild) {
            console.log('Sending xAPI statement to server:', statement);
            $.ajax({
              type: "POST",
              url: contentxResultSaveUrl,
              data: JSON.stringify(event.data.statement),
            })
            .done(function (response) {
              console.log('xAPI statement saved successfully:', response);
            })
            .fail(function (error) {
              console.error('Failed to save xAPI statement:', error);
            });
          }
        });

        return Promise.resolve("Result successfully");
      } catch (error) {
        console.error('Error initializing H5P content:', error.message);
        return Promise.reject(error.message);
      }
    } else {
      console.log('H5P element not found or already initialized:', args.player_id);
    }
  }
}

function loadJS() {
  return new Promise((resolve) => {
    if (window.H5PStandalone) {
      console.log('H5PStandalone already loaded');
      resolve();
    } else {
      console.log('Loading H5PStandalone script from CDN');
      $.getScript(
        "https://cdn.jsdelivr.net/npm/h5p-standalone@3.7.0/dist/main.bundle.js"
      )
        .done(function () {
          console.log('H5PStandalone loaded successfully');
          window.H5PStandalone = H5PStandalone;
          resolve();
        })
        .fail(function (error) {
          console.error('Error loading H5PStandalone:', error);
        });
    }
  });
}