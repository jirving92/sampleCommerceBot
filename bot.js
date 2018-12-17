// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// bot.js is your main bot dialog entry point for handling activity types

// Import required Bot Builder
const { ActivityTypes, CardFactory, MessageFactory } = require("botbuilder");
const { LuisRecognizer } = require("botbuilder-ai");
const {
  DialogSet,
  DialogTurnStatus,
  WaterfallDialog,
  TextPrompt,
  NumberPrompt,
  ChoicePrompt
} = require("botbuilder-dialogs");

const { UserProfile } = require("./dialogs/greeting/userProfile");
const { WelcomeCard } = require("./dialogs/welcome");
const { GreetingDialog } = require("./dialogs/greeting");
const { CourseDialog } = require("./dialogs/course");
const { CourseCart } = require("./dialogs/course/courseCart");
const {
  BotConnection,
  bioBooks,
  mathBooks,
  psychBooks,
  computerScienceBooks
} = require("./botConnection");

// Greeting Dialog ID
const GREETING_DIALOG = "greetingDialog";
const COURSE_DIALOG = "courseDialog";
const SELECTION_PROMPT = "prompt-companySelection";
const DONE_OPTION = "done";
const BOOK_OPTIONS = [];
const BOOKS_SELECTED = "value-booksSelected";
const TOP_LEVEL_DIALOG = "dialog-toplevel";
const REVIEW_SELECTION_DIALOG = "dialog-reviewSelection";
const END_OF_BOOKS_DIALOG = "dialog-reviewEndOfBooks";

// State Accessor Properties
const DIALOG_STATE_PROPERTY = "dialogState";
const USER_PROFILE_PROPERTY = "userProfileProperty";
const COURSE_CART_PROPERTY = "courseCartProperty";

// LUIS service type entry as defined in the .bot file.
const LUIS_CONFIGURATION = "testbotluis";

// Supported LUIS Intents.
const GREETING_INTENT = "Greeting";
const CANCEL_INTENT = "Cancel";
const HELP_INTENT = "Help";
const NONE_INTENT = "None";
const COURSE_INTENT = "Course";

// Supported LUIS Entities, defined in ./dialogs/greeting/resources/greeting.lu
const USER_NAME_ENTITIES = ["userName", "userName_patternAny"];
const USER_LOCATION_ENTITIES = ["userLocation", "userLocation_patternAny"];
const USER_UNIVERSITY_ENTITIES = ["university", "university_patternAny"];
const USER_BIOLOGY_ENTITIES = ["biology", "biology_patternAny"];
const USER_PSYCHOLOGY_ENTITIES = ["psychology", "psychology_patternAny"];
const USER_MATH_ENTITIES = ["math", "math_patternAny"];
const USER_COMPUTERSCIENCE_ENTITIES = [
  "computerScience",
  "computerScience_patternAny"
];

//Connection
var botConnection = new BotConnection();
botConnection.Connection();

/**
 * Timeout in order to wait for the connection to be made
 * and the results to be returned
 */
setTimeout(() => console.log("FROM BOT: ", bioBooks), 5000);
setTimeout(() => console.log("FROM BOT: ", mathBooks), 5000);
setTimeout(() => console.log("FROM BOT: ", psychBooks), 5000);
setTimeout(() => console.log("FROM BOT: ", computerScienceBooks), 5000);

class BasicBot {
  /**
   * Constructs the three pieces necessary for this bot to operate:
   * 1. StatePropertyAccessor for conversation state
   * 2. StatePropertyAccess for user state
   * 3. LUIS client
   * 4. DialogSet to handle our GreetingDialog
   *
   * @param {ConversationState} conversationState property accessor
   * @param {UserState} userState property accessor
   * @param {BotConfiguration} botConfig contents of the .bot file
   */
  constructor(conversationState, userState, botConfig) {
    if (!conversationState)
      throw new Error("Missing parameter.  conversationState is required");
    if (!userState)
      throw new Error("Missing parameter.  userState is required");
    if (!botConfig)
      throw new Error("Missing parameter.  botConfig is required");

    // Add the LUIS recognizer.
    const luisConfig = botConfig.findServiceByNameOrId(LUIS_CONFIGURATION);
    if (!luisConfig || !luisConfig.appId)
      throw new Error(
        "Missing LUIS configuration. Please follow README.MD to create required LUIS applications.\n\n"
      );
    const luisEndpoint =
      luisConfig.region && luisConfig.region.indexOf("https://") === 0
        ? luisConfig.region
        : luisConfig.getEndpoint();
    this.luisRecognizer = new LuisRecognizer({
      applicationId: luisConfig.appId,
      endpoint: luisEndpoint,
      // CAUTION: Its better to assign and use a subscription key instead of authoring key here.
      endpointKey: luisConfig.authoringKey
    });

    // Create the property accessors for user and conversation state
    this.userProfileAccessor = userState.createProperty(USER_PROFILE_PROPERTY);
    this.courseCartAccessor = userState.createProperty(COURSE_CART_PROPERTY);
    this.dialogState = conversationState.createProperty(DIALOG_STATE_PROPERTY);

    // Create top-level dialog(s)
    this.dialogs = new DialogSet(this.dialogState);
    // Add the Greeting dialog to the set
    this.dialogs.add(
      new GreetingDialog(
        GREETING_DIALOG,
        this.userProfileAccessor,
        REVIEW_SELECTION_DIALOG,
        END_OF_BOOKS_DIALOG
      )
    );
    this.dialogs.add(new CourseDialog(COURSE_DIALOG, this.courseCartAccessor));
    this.dialogs.add(new ChoicePrompt(SELECTION_PROMPT));

    // for the book selector
    this.dialogs.add(
      new WaterfallDialog(REVIEW_SELECTION_DIALOG)
        .addStep(this.selectionStep.bind(this))
        .addStep(this.loopStep.bind(this))
    );

    this.dialogs.add(
      new WaterfallDialog(END_OF_BOOKS_DIALOG)
      .addStep(this.removeLastBook.bind(this))
      .addStep(this.loopStep.bind(this))
    );

    this.conversationState = conversationState;
    this.userState = userState;
  }

  async removeLastBook(context) {
    const list = Array.isArray(context.options) ? context.options : [];
    context.values[BOOKS_SELECTED] = list;

    //temp prompt until I get things to work the way I want
    let message;
    message =
      `You have selected **${list[0]}**. You can add another book, ` +
      "or choose `" +
      DONE_OPTION +
      "` to finish.";

    //Create temp list
    const options = bioBooks.filter(function(item) {
      return item !== list[0];
    });
    options.push(DONE_OPTION);

    return await context.prompt(SELECTION_PROMPT, {
      prompt: message,
      retryPrompt: "Please choose an option from the list.",
      choices: options
    });
  }

  //To select the book you are looking for
  async selectionStep(context) {
    const tempCourseType = context.context._activity.text;
    console.log("SELECTION STEP");
    // console.log("COURSE: ", tempCourseType);
    console.log("CONTEXT", context);

    /**
     * Uses the same list. If this is the second step, it will add the
     * new book to the list. If not, then starts new list.
     * */
    const list = Array.isArray(context.options) ? context.options : [];
    context.values[BOOKS_SELECTED] = list;

    //temp prompt until I get things to work the way I want
    let message;
    if (list.length === 0) {
      message =
        "Please select a textbook, or `" +
        DONE_OPTION +
        "` to move to the cart.";
    } else {
      message =
        `You have selected **${list[0]}**. You can add another book, ` +
        "or choose `" +
        DONE_OPTION +
        "` to finish.";
    }

    //Create temp list
    const options =
      list.length > 0
        ? bioBooks.filter(function(item) {
            return item !== list[0];
          })
        : bioBooks.slice();
    options.push(DONE_OPTION);

    return await context.prompt(SELECTION_PROMPT, {
      prompt: message,
      retryPrompt: "Please choose an option from the list.",
      choices: options
    });
  }

  async loopStep(context) {
    //get list of books they selected, and if they're done or not
    const list = context.values[BOOKS_SELECTED];
    const choice = context.result;
    console.log("CHOICE, ", choice);
    const done = choice.value === DONE_OPTION;

    if (!done) {
      //add choice to the list
      list.push(choice.value);
    }
    if (done || list.length > 1) {
      console.log("HERE");
      //exit if they're done
      return await context.endDialog(list);
    } else {
      console.log("ELSE");
      //otherwise, repeat dialog and continue adding to the list
      return await context.replaceDialog(END_OF_BOOKS_DIALOG, list);
    }
  }

  /**
   * Driver code that does one of the following:
   * 1. Display a welcome card upon receiving ConversationUpdate activity
   * 2. Use LUIS to recognize intents for incoming user message
   * 3. Start a greeting dialog
   * 4. Optionally handle Cancel or Help interruptions
   *
   * @param {Context} context turn context from the adapter
   */
  async onTurn(context) {
    if (context.activity.type === ActivityTypes.Message) {
      let dialogResult;

      const dc = await this.dialogs.createContext(context);

      const results = await this.luisRecognizer.recognize(context);
      const topIntent = LuisRecognizer.topIntent(results);

      await this.updateUserProfile(results, context);

      const interrupted = await this.isTurnInterrupted(dc, results);
      if (interrupted) {
        if (dc.activeDialog !== undefined) {
          dialogResult = await dc.repromptDialog();
        }
      } else {
        dialogResult = await dc.continueDialog();
      }

      // If no active dialog or no active dialog has responded,
      if (!dc.context.responded) {
        // Switch on return results from any active dialog.
        switch (dialogResult.status) {
          // dc.continueDialog() returns DialogTurnStatus.empty if there are no active dialogs
          case DialogTurnStatus.empty:
            // Determine what we should do based on the top intent from LUIS.
            switch (topIntent) {
              case GREETING_INTENT:
                await dc.beginDialog(GREETING_DIALOG);
                // return await dc.context.beginDialog(REVIEW_SELECTION_DIALOG);
                break;
              case COURSE_INTENT:
                const usersCourseChoice = dc.context._activity.text.toLowerCase();
                let courseEntity;
                // console.log("CHOICE: ", usersCourseChoice);
                if (usersCourseChoice === "Biology") {
                  courseEntity = results.entities.biology[0];
                } else if (usersCourseChoice === "Math") {
                  courseEntity = results.entities.math[0];
                } else if (usersCourseChoice === "Psychology") {
                  courseEntity = results.entities.psychology[0];
                } else if (usersCourseChoice === "Computer Science") {
                  courseEntity = results.entities.computerScience[0];
                }
                // BRING THIS BACK
                await dc.beginDialog(
                  REVIEW_SELECTION_DIALOG,
                  usersCourseChoice
                );

                // await this.selectionStep(context);
                // await this.loopStep(context);
                // console.log("BIO BOOKS: ", bioBooks);
                // console.log("PSYCH BOOKS: ", psychBooks);
                // console.log("MATH BOOKS: ", mathBooks);
                // console.log("CS BOOKS: ", computerScienceBooks);

                // await dc.context
                //   .sendActivity(`These are the textbooks that are currently
                // available for ${usersCourseChoice}:`);
                // var reply = MessageFactory.suggestedActions(
                //   bioBooks,
                //   "These are the textbooks that are currently available."
                // );
                // await dc.context.sendActivity(reply);

                // await dc.beginDialog(COURSE_DIALOG);
                break;
              case NONE_INTENT:
              default:
                // None or no intent identified, either way, let's provide some help
                // to the user
                await dc.context.sendActivity(
                  `I didn't understand what you just said to me.`
                );
                break;
            }
            break;
          case DialogTurnStatus.waiting:
            // The active dialog is waiting for a response from the user, so do nothing.
            break;
          case DialogTurnStatus.complete:
            // All child dialogs have ended. so do nothing.
            break;
          default:
            // Unrecognized status from child dialog. Cancel all dialogs.
            await dc.cancelAllDialogs();
            break;
        }
      }
    } else if (context.activity.type === ActivityTypes.ConversationUpdate) {
      // Handle ConversationUpdate activity type, which is used to indicates new members add to
      // the conversation.
      // see https://aka.ms/about-bot-activity-message to learn more about the message and other activity types

      // Do we have any new members added to the conversation?
      if (context.activity.membersAdded.length !== 0) {
        // Iterate over all new members added to the conversation
        for (var idx in context.activity.membersAdded) {
          // Greet anyone that was not the target (recipient) of this message
          // the 'bot' is the recipient for events from the channel,
          // context.activity.membersAdded == context.activity.recipient.Id indicates the
          // bot was added to the conversation.
          if (
            context.activity.membersAdded[idx].id !==
            context.activity.recipient.id
          ) {
            // Welcome user.
            // When activity type is "conversationUpdate" and the member joining the conversation is the bot
            // we will send our Welcome Adaptive Card.  This will only be sent once, when the Bot joins conversation
            // To learn more about Adaptive Cards, see https://aka.ms/msbot-adaptivecards for more details.
            const welcomeCard = CardFactory.adaptiveCard(WelcomeCard);
            await context.sendActivity({ attachments: [welcomeCard] });
          }
        }
      }
    }
    // make sure to persist state at the end of a turn.
    await this.conversationState.saveChanges(context);
    await this.userState.saveChanges(context);
  }

  /**
   * Look at the LUIS results and determine if we need to handle
   * an interruptions due to a Help or Cancel intent
   *
   * @param {DialogContext} dc - dialog context
   * @param {LuisResults} luisResults - LUIS recognizer results
   */
  async isTurnInterrupted(dc, luisResults) {
    const topIntent = LuisRecognizer.topIntent(luisResults);

    // see if there are anh conversation interrupts we need to handle
    if (topIntent === CANCEL_INTENT) {
      if (dc.activeDialog) {
        // cancel all active dialog (clean the stack)
        await dc.cancelAllDialogs();
        await dc.context.sendActivity(`Ok.  I've cancelled our last activity.`);
      } else {
        await dc.context.sendActivity(
          `I don't have anything to cancel.  Score: ${topIntent}`
        );
      }
      return true; // this is an interruption
    }

    if (topIntent === HELP_INTENT) {
      await dc.context.sendActivity(`Let me try to provide some help.`);
      await dc.context.sendActivity(
        `I understand greetings, being asked for help, or being asked to cancel what I am doing.`
      );
      return true; // this is an interruption
    }
    return false; // this is not an interruption
  }

  /**
   * Helper function to update user profile with entities returned by LUIS.
   *
   * @param {LuisResults} luisResults - LUIS recognizer results
   * @param {DialogContext} dc - dialog context
   */
  async updateUserProfile(luisResult, context) {
    // Do we have any entities?
    if (Object.keys(luisResult.entities).length !== 1) {
      // get userProfile object using the accessor
      let userProfile = await this.userProfileAccessor.get(context);
      if (userProfile === undefined) {
        userProfile = new UserProfile();
      }
      // see if we have any user name entities
      USER_NAME_ENTITIES.forEach(name => {
        if (luisResult.entities[name] !== undefined) {
          let lowerCaseName = luisResult.entities[name][0];
          // capitalize and set user name
          userProfile.name =
            lowerCaseName.charAt(0).toUpperCase() + lowerCaseName.substr(1);
          // console.log("HERE IN ENTITY");
        }
      });
      USER_LOCATION_ENTITIES.forEach(city => {
        if (luisResult.entities[city] !== undefined) {
          let lowerCaseCity = luisResult.entities[city][0];
          // capitalize and set user name
          userProfile.city =
            lowerCaseCity.charAt(0).toUpperCase() + lowerCaseCity.substr(1);
        }
      });
      USER_UNIVERSITY_ENTITIES.forEach(university => {
        if (luisResult.entities[university] !== undefined) {
          let lowerCaseUniversity = luisResult.entities[university][0];
          // capitalize and set user name
          userProfile.university =
            lowerCaseUniversity.charAt(0).toUpperCase() +
            lowerCaseUniversity.substr(1);
        }
      });
      USER_BIOLOGY_ENTITIES.forEach(biology => {
        if (luisResult.entities[biology] !== undefined) {
          let lowerCaseBiology = luisResult.entities[biology][0];
          // capitalize and set user name
          userProfile.course =
            lowerCaseBiology.charAt(0).toUpperCase() +
            lowerCaseBiology.substr(1);
        }
      });
      // set the new values
      await this.userProfileAccessor.set(context, userProfile);
    }
  }
}

module.exports.BasicBot = BasicBot;
