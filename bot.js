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
  bioBooksPrices,
  mathBooks,
  mathBooksPrices,
  psychBooks,
  psychBooksPrices,
  computerScienceBooks,
  computerScienceBooksPrices,
  supplies,
  suppliesPrices
} = require("./botConnection");

// Greeting Dialog ID
const GREETING_DIALOG = "greetingDialog";
const COURSE_DIALOG = "courseDialog";
const SUPPLY_SELECTION_DIALOG = "dialog-reviewSupplySelection";
const ANOTHER_COURSE_SELECTION_DIALOG = "dialog-anotherCourseSelection";
const SELECTION_PROMPT = "prompt-companySelection";
const SUPPLY_SELECTION_PROMPT = "prompt-supplySelection";
const ANOTHER_COURSE_SELECTION_PROMPT = "prompt-anotherCourseSelection";
const DONE_OPTION = "done";
const YES_OPTION = "yes";
let BOOK_OPTIONS = [];
let BOOK_OPTIONS_PRICES = [];
let BOOK_LIST = [];
let SUPPLY_LIST = [];
const BOOKS_SELECTED = "value-booksSelected";
const SUPPLIES_SELECTED = "value-suppliesSelected";
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
setTimeout(() => console.log("FROM BOT: ", bioBooksPrices), 5000);
setTimeout(() => console.log("FROM BOT: ", mathBooks), 5000);
setTimeout(() => console.log("FROM BOT: ", mathBooksPrices), 5000);
setTimeout(() => console.log("FROM BOT: ", psychBooks), 5000);
setTimeout(() => console.log("FROM BOT: ", psychBooksPrices), 5000);
setTimeout(() => console.log("FROM BOT: ", computerScienceBooks), 5000);
setTimeout(() => console.log("FROM BOT: ", computerScienceBooksPrices), 5000);
setTimeout(() => console.log("FROM BOT: ", supplies), 5000);
setTimeout(() => console.log("FROM BOT: ", suppliesPrices), 5000);

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
        END_OF_BOOKS_DIALOG,
        SUPPLY_SELECTION_DIALOG,
        ANOTHER_COURSE_SELECTION_DIALOG
      )
    );
    this.dialogs.add(new CourseDialog(COURSE_DIALOG, this.courseCartAccessor));
    this.dialogs.add(new ChoicePrompt(SELECTION_PROMPT));
    this.dialogs.add(new ChoicePrompt(SUPPLY_SELECTION_PROMPT));
    this.dialogs.add(new ChoicePrompt(ANOTHER_COURSE_SELECTION_PROMPT));

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

    this.dialogs.add(
      new WaterfallDialog(SUPPLY_SELECTION_DIALOG)
        .addStep(this.supplySelectionStep.bind(this))
        .addStep(this.supplyLoopStep.bind(this))
    );

    this.dialogs.add(
      new WaterfallDialog(ANOTHER_COURSE_SELECTION_DIALOG)
        .addStep(this.selectAnotherCoursePrompt.bind(this))
        .addStep(this.selectAnotherCourseLoop.bind(this))
    );

    this.conversationState = conversationState;
    this.userState = userState;
  }

  async removeLastBook(context) {
    const list = Array.isArray(context.options) ? context.options : [];
    context.values[BOOKS_SELECTED] = list;

    let message;
    message =
      `You have selected **${
        list[0].split("(")[0]
      }**. You can add another book, ` +
      "or choose `" +
      DONE_OPTION +
      "` to finish.";

    //Create temp list
    const options = BOOK_OPTIONS.filter(function(item) {
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
    /**
     * Uses the same list. If this is the second step, it will add the
     * new book to the list. If not, then starts new list.
     * */
    const list = Array.isArray(context.options) ? context.options : [];
    context.values[BOOKS_SELECTED] = list;

    let message;
    if (list.length === 0) {
      message =
        "Please select a textbook, or `" +
        DONE_OPTION +
        "` to move to the cart.";
    } else {
      message =
        `You have selected **${
          list[0].split("(")[0]
        }**. You can add another book, ` +
        "or choose `" +
        DONE_OPTION +
        "` to finish.";
    }

    for (var i = 0; i < BOOK_OPTIONS.length; i++) {
      BOOK_OPTIONS[i] =
        BOOK_OPTIONS[i] +
        " (Price: $" +
        BOOK_OPTIONS_PRICES[BOOK_OPTIONS.indexOf(BOOK_OPTIONS[i])] +
        " )";
    }

    const options =
      list.length > 0
        ? BOOK_OPTIONS.filter(function(item) {
            return item !== list[0];
          })
        : BOOK_OPTIONS.slice();
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
    const done = choice.value === DONE_OPTION;
    console.log("CHOICE: ", choice.value.split("(")[0]);

    if (!done) {
      //add choice to the list
      list.push(choice.value);
    }
    if (done || list.length > 1) {
      //exit if they're done
      BOOK_LIST = BOOK_LIST.concat(list);
      console.log("BOOK LIST: ", BOOK_LIST);
      return await this.completedBookSelection(context);
    } else {
      //otherwise, repeat dialog and continue adding to the list
      return await context.replaceDialog(END_OF_BOOKS_DIALOG, list);
    }
  }

  /**
   * When the user is done completing books, move to this step which
   * will begin the waterfall steps to select all the required
   * school supplies
   * @param {Context} context
   */
  async completedBookSelection(context) {
    for (var i = 0; i < supplies.length; i++) {
      supplies[i] =
        supplies[i] +
        " (Price: $" +
        suppliesPrices[supplies.indexOf(supplies[i])] +
        " )";
    }
    return await context.beginDialog(SUPPLY_SELECTION_DIALOG);
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
                break;
              case COURSE_INTENT:
                const usersCourseChoice = dc.context._activity.text.toLowerCase();
                let courseEntity;
                // console.log("CHOICE: ", usersCourseChoice);
                if (usersCourseChoice === "biology") {
                  courseEntity = results.entities.biology[0];
                  BOOK_OPTIONS = bioBooks;
                  BOOK_OPTIONS_PRICES = bioBooksPrices;
                } else if (usersCourseChoice === "math") {
                  courseEntity = results.entities.math[0];
                  BOOK_OPTIONS = mathBooks;
                  BOOK_OPTIONS_PRICES = mathBooksPrices;
                } else if (usersCourseChoice === "psychology") {
                  courseEntity = results.entities.psychology[0];
                  BOOK_OPTIONS = psychBooks;
                  BOOK_OPTIONS_PRICES = psychBooksPrices;
                } else if (usersCourseChoice === "computer science") {
                  courseEntity = results.entities.computerScience[0];
                  BOOK_OPTIONS_PRICES = computerScienceBooksPrices;
                  BOOK_OPTIONS = computerScienceBooks;
                }
                // BRING THIS BACK
                await dc.beginDialog(
                  REVIEW_SELECTION_DIALOG,
                  usersCourseChoice
                );
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

            let totalCost = 0;
            for (var i = 0; i < BOOK_LIST.length; i++) {
              totalCost += Number(
                BOOK_LIST[i]
                  .substring(BOOK_LIST[i].indexOf("$") + 1)
                  .split(" ")[0]
              );
            }

            for (var i = 0; i < SUPPLY_LIST.length; i++) {
              totalCost += Number(
                SUPPLY_LIST[i]
                  .substring(SUPPLY_LIST[i].indexOf("$") + 1)
                  .split(" ")[0]
              );
            }

            console.log("TOTAL COST: ", totalCost);

            for (var i = 0; i < BOOK_LIST.length; i++) {
              BOOK_LIST[i] = BOOK_LIST[i].split("(")[0];
            }

            for (var i = 0; i < SUPPLY_LIST.length; i++) {
              SUPPLY_LIST[i] = SUPPLY_LIST[i].split("(")[0];
            }

            await dc.context.sendActivity(
              `You have selected ` +
                BOOK_LIST.join(" and ") +
                "." +
                ` For supplies you have selected ` +
                SUPPLY_LIST.join(" and ") +
                "." +
                " Your total cost is: $" +
                totalCost +
                "."
            );
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

  //To select supplies
  async supplySelectionStep(context) {
    const list = Array.isArray(context.options) ? context.options : [];
    context.values[SUPPLIES_SELECTED] = list;

    let message;
    if (list.length === 0) {
      message =
        "Please select supplies, or `" + DONE_OPTION + "` to move to the cart.";
    } else {
      message =
        `You have selected **${
          list[0].split("(")[0]
        }**. You can add more supplies, ` +
        "or choose `" +
        DONE_OPTION +
        "` to finish.";
    }

    const options =
      list.length > 0
        ? supplies.filter(function(item) {
            return item !== list[0];
          })
        : supplies.slice();
    options.push(DONE_OPTION);

    return await context.prompt(SUPPLY_SELECTION_PROMPT, {
      prompt: message,
      retryPrompt: "Please choose an option from the list.",
      choices: options
    });
  }

  async supplyLoopStep(context) {
    //get list of supplies they selected, and if they're done or not
    const list = context.values[SUPPLIES_SELECTED];
    const choice = context.result;
    const done = choice.value === DONE_OPTION;

    if (!done) {
      //add choice to the list
      list.push(choice.value);
    }
    if (done || list.length > 1) {
      SUPPLY_LIST = SUPPLY_LIST.concat(list);
      console.log("SUPPLY LIST: ", SUPPLY_LIST);
      return await context.beginDialog(ANOTHER_COURSE_SELECTION_DIALOG);
    } else {
      //otherwise, repeat dialog and continue adding to the list
      return await context.replaceDialog(SUPPLY_SELECTION_DIALOG, list);
    }
  }

  async selectAnotherCoursePrompt(context) {
    let message;
    message =
      "Please select `" +
      YES_OPTION +
      "` if you'd lke to select another course, or `" +
      DONE_OPTION +
      "` to move to complete your order.";
    //Create temp list
    const options = ["yes", "done"];

    return await context.prompt(ANOTHER_COURSE_SELECTION_PROMPT, {
      prompt: message,
      retryPrompt: "Please choose an option from the list.",
      choices: options
    });
  }

  async selectAnotherCourseLoop(context) {
    const choice = context.result;
    const done = choice.value === DONE_OPTION;
    const yes = choice.value === YES_OPTION;

    if (!done) {
      //add choice to the list
      return await context.beginDialog(GREETING_DIALOG);
    } else {
      return await context.endDialog();
    }
  }
}

module.exports.BasicBot = BasicBot;
