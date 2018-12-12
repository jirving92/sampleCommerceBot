// course.js defines the greeting dialog

// Import required Bot Builder
const { ComponentDialog, WaterfallDialog, TextPrompt } = require('botbuilder-dialogs');

// User state for greeting dialog
const { CourseCart } = require('./courseCart');

// Minimum length requirements for city and name
const COURSE_NAME_LENGTH_MIN = 3;

// Dialog IDs 
const COURSE_CART_DIALOG = 'courseCart';

// Prompt IDs
const COURSE_NAME_PROMPT = 'courseNamePrompt';

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
        if (!dialogId) throw ('Missing parameter.  dialogId is required');
        if (!courseCartAccessor) throw ('Missing parameter.  courseCartAccessor is required');

        // Add a water fall dialog with 4 steps.
        // The order of step function registration is importent
        // as a water fall dialog executes steps registered in order
        this.addDialog(new WaterfallDialog(COURSE_CART_DIALOG, [
            this.initializeStateStep.bind(this),
            this.promptForCourseNameStep.bind(this),
            this.displayCourseStep.bind(this)
        ]));

        // Add text prompts for name and city
        this.addDialog(new TextPrompt(COURSE_NAME_PROMPT, this.validateCourseName));

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
                await this.courseCartAccessor.set(step.context, step.options.courseCart);
            } else {
                await this.courseCartAccessor.set(step.context, new CourseCart());
            }
        }
        return await step.next();
    }
    /**
     * Waterfall Dialog step functions.
     *
     * Using a text prompt, prompt the user for their name.
     * Only prompt if we don't have this information already.
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async promptForCourseNameStep(step) {
        const courseCart = await this.courseCartAccessor.get(step.context);
        // if we have everything we need, greet user and return
        if (courseCart !== undefined && courseCart.courseName !== undefined) {
            return await this.greetUser(step);
        }
        if (!userProfile.courseName) {
            // prompt for name, if missing
            return await step.prompt(COURSE_NAME_PROMPT, 'Which course are you looking for?');
        } else {
            return await step.next();
        }
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Having all the data we need, simply display a summary back to the user.
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async displayCourseStep(step) {
        // Save city, if prompted for
        const courseCart = await this.courseCartAccessor.get(step.context);
        if (courseCart.courseName === undefined && step.result) {
            let lowerCaseCourse = step.result;
            console.log("RESULT: ", step.result, "CONTEXT: ", step.context);
            // capitalize and set city
            courseCart.courseName = lowerCaseCourse.charAt(0).toUpperCase() + lowerCaseCourse.substr(1);
            await this.courseCartAccessor.set(step.context, courseCart);
        } 
        if (courseCart.courseName === undefined && step.result) {
            await this.courseCartAccessor.set(step.context, courseCart);
        } 
        return await this.greetUser(step);
    }
    /**
     * Validator function to verify that user name meets required constraints.
     *
     * @param {PromptValidatorContext} validation context for this validator.
     */
    async validateCourseName(validatorContext) {
        // Validate that the user entered a minimum length for their name
        const value = (validatorContext.recognized.value || '').trim();
        if (value.length >= COURSE_NAME_LENGTH_MIN) {
            return VALIDATION_SUCCEEDED;
        } else {
            await validatorContext.context.sendActivity(`Course names need to be at least ${ NAME_LENGTH_MIN } characters long.`);
            return VALIDATION_FAILED;
        }
    }

    /**
     * Helper function to greet user with information in greetingState.
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async greetUser(step) {
        const courseCart = await this.courseCartAccessor.get(step.context);
        // Display to the user their profile information and end dialog
        await step.context.sendActivity(`Course you picked: ${courseCart.courseName}`);
        return await step.endDialog();
    }
}

exports.CourseDialog = Course;
