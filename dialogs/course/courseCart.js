/**
 * Simple course cart class.
 */
class CourseCart {
    constructor(courseName, courseBookName, courseBookPrice) {
        this.courseName = courseName || undefined;
        this.courseBookName = courseBookName || undefined;
        this.coursebookPrice = courseBookPrice || undefined;
    }
};

exports.CourseCart = CourseCart;
