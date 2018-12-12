// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * Simple user profile class.
 */
class UserProfile {
    constructor(name, city, university, course) {
        this.name = name || undefined;
        this.city = city || undefined;
        this.university = university || undefined;
        this.course = course || undefined;
    }
};

exports.UserProfile = UserProfile;
