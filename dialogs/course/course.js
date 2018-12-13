// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// greeting.js defines the greeting dialog

// Import required Bot Builder
const {
  ComponentDialog,
  WaterfallDialog,
  TextPrompt
} = require("botbuilder-dialogs");

// User state for greeting dialog
const { CourseCart } = require("./courseCart");

// Minimum length requirements for city and name
const COURSE_LENGTH_MIN = 3;

// Dialog IDs
const COURSE_CART_DIALOG = "courseCartDialog";

const VALIDATION_SUCCEEDED = true;
const VALIDATION_FAILED = !VALIDATION_SUCCEEDED;

/**
 * Demonstrates the following concepts:
 *  Use a subclass of ComponentDialog to implement a multi-turn conversation
 *  Use a Waterfall dialog to model multi-turn conversation flow
 *  Use custom prompts to validate user input
 *  Store conversation and user state
 *
 * @param {String} dialogId unique identifier for this dialog instance
 * @param {PropertyStateAccessor} courseCartAccessor property accessor for user state
 */
class Course extends ComponentDialog {
  constructor(dialogId, courseCartAccessor) {
    super(dialogId);

    // validate what was passed in
    if (!dialogId) throw "Missing parameter.  dialogId is required";
    if (!courseCartAccessor)
      throw "Missing parameter.  courseCartAccessor is required";

    // Add a water fall dialog with 4 steps.
    // The order of step function registration is importent
    // as a water fall dialog executes steps registered in order
    this.addDialog(
      new WaterfallDialog(COURSE_CART_DIALOG, [
        this.initializeStateStep.bind(this)
      ])
    );

    // Save off our state accessor for later use
    this.courseCartAccessor = courseCartAccessor;
  }
  /**
   * Waterfall Dialog step functions.
   *
   * Initialize our state.  See if the WaterfallDialog has state pass to it
   * If not, then just new up an empty UserProfile object
   *
   * @param {WaterfallStepContext} step contextual information for the current step being executed
   */
  async initializeStateStep(step) {
    let courseCart = await this.courseCartAccessor.get(step.context);
    if (courseCart === undefined) {
      if (step.options && step.options.courseCart) {
        await this.courseCartAccessor.set(
          step.context,
          step.options.courseCart
        );
      } else {
        await this.courseCartAccessor.set(step.context, new CourseCart());
      }
    }
    return await step.endDialog();
  }
}

exports.CourseDialog = Course;
