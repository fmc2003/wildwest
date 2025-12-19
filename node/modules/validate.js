//validate.js
//module to validate user input
//exports functions to validate required fields, email format, password strength, and display name uniqueness
//used in registration and profile update forms
//each function returns true if valid, false otherwise

module.exports = {
  //check if string is non-empty
  required(value) {
    return typeof value === 'string' && value.trim() !== '';
  },

  //check if email is valid
  email(value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  //password strength check
  strongPassword(value) {
    //at least 8 characters, one uppercase, one lowercase, one number, one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(value);
  },

  //display name must differ from username
  displayName(username, displayName) {
    return username !== displayName;
  }
};
