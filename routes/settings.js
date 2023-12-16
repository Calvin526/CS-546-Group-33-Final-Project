import express from 'express';
const router = express.Router();
import validation from '../helpers.js';

import {groupsData} from '../data/index.js';
import {usersData} from '../data/index.js';
import {messagesData} from '../data/index.js';
import {phone} from 'phone';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';


router.route('/')
  .get(async (req, res) => {
    let userId = req.session.user.id;
    let admin = req.session.user.admin;
    userId = validation.checkId(userId, "userId");
    const userInfo = await usersData.getUser(userId);
    res.render("settings", { 
      title: "Settings",
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      emailAddress: userInfo.emailAddress,
      phoneNumber: userInfo.phoneNumber,
      age: userInfo.age,
      interests: userInfo.interests,
      biography: userInfo.biography,
      admin: admin
    });
  })
  .post(async (req, res) => {
    let { 
      firstNameInput, lastNameInput, emailAddressInput, 
      phonenumberInput, passwordInput, confirmPasswordInput, 
      biographyInput, ageInput, interestsInput 
    } = req.body;

    const id = req.session.user.id;
    let userId = new ObjectId(id);

    console.log(req.body);

    const errors = [];
    if (firstNameInput && !/^[a-zA-Z]{2,25}$/.test(firstNameInput)) errors.push("Invalid First Name");
    if (lastNameInput && !/^[a-zA-Z]{2,25}$/.test(lastNameInput)) errors.push("Invalid Last Name");
    if (emailAddressInput && !/\S+@\S+\.\S+/.test(emailAddressInput.toLowerCase())) errors.push("Invalid Email Address");
    if (passwordInput && !/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/.test(passwordInput)) errors.push("Invalid Password");
    if (passwordInput && passwordInput !== confirmPasswordInput) errors.push("Passwords do not match");
    if (biographyInput && !/^.{2,200}$/.test(biographyInput)) errors.push("Invalid Biography");
    if (ageInput) {
      let age = typeof ageInput === 'number' ? ageInput : parseInt(ageInput);
      if (!Number.isInteger(age) || age < 18 || age > 120) errors.push("Invalid Age");
    }
    if (interestsInput) {
      if (typeof interestsInput === 'string') {
        interestsInput = interestsInput.split(',').map(interest => interest.trim());
      }
      if (!Array.isArray(interestsInput) || !interestsInput.every(interest => typeof interest === 'string')) {
        errors.push("Interests must be a list of strings");
      }
    }
    if (phonenumberInput) {
      phonenumberInput = phone(phonenumberInput);
      if (!phonenumberInput.isValid) errors.push('Invalid phone number!');
      phonenumberInput = phonenumberInput.phoneNumber;
    }
    

    if (errors.length > 0) {
      return res.status(400).render("settings", { title: "Settings", error: errors, userData: req.body });
    }

    const saltRounds = await bcrypt.genSalt(8);
    const hashedPass = await bcrypt.hash(passwordInput, saltRounds);

    try {
      const updatedFields = {
        ...(firstNameInput && { firstName: firstNameInput }),
        ...(lastNameInput && { lastName: lastNameInput }),
        ...(emailAddressInput && { emailAddress: emailAddressInput }),
        ...(phonenumberInput && { phoneNumber: phonenumberInput }),
        ...(passwordInput && { password: hashedPass }),
        ...(biographyInput && { biography: biographyInput }),
        ...(ageInput && { age: parseInt(ageInput) }),
        ...(interestsInput && { interests: interestsInput }),
      };

      const updatedUser = await usersData.updateUser(userId, updatedFields);
      
      if (updatedUser) {
        return res.redirect("/logout");
      } else {
        return res.status(500).render("settings", { title: "Settings", error: "Internal Server Error", userData: req.body });
      }
    } catch (e) {
      return res.status(500).render("settings", { title: "Settings", error: e.toString(), userData: req.body });
    }
  });

  
 
  router.route('/admin')
  .get(async (req, res) => {
    let userId = req.session.user.id;
    userId = validation.checkId(userId, "userId");
    const groupId = await groupsData.getGroupByUserId(userId);
    const groupInfo = await groupsData.get(groupId);
    let femalePref = groupInfo.genderPreference === 'F';
    let malePref = groupInfo.genderPreference === 'M';
    res.render("adminSettings", { 
      title: "Admin Settings",
      admin: true,
      groupInfo: groupInfo,
      malePref: malePref,
      femalePref: femalePref
    });
  })
  .post(async (req, res) => {
    let {
      groupNameInput,
      groupUsernameInput,
      groupDescriptionInput,
      budgetInput,
      genderPreferenceInput,
      groupPasswordInput,
      groupConfirmPasswordInput
    }
    = req.body;

    console.log(req.body)
    
    let userId = req.session.user.id;
    userId = validation.checkId(userId, "userId");
    const groupId = await groupsData.getGroupByUserId(userId);
    const groupInfo = await groupsData.get(groupId);
    budgetInput = parseInt(budgetInput);

    const errors = [];
    let newPassword = true;
    if (groupPasswordInput.length >= 8 && groupConfirmPasswordInput.length >= 8) newPassword = true;
    if (typeof groupNameInput !== "string") errors.push("Invalid Group Name");
    if (typeof groupUsernameInput !== "string") errors.push("Invalid Group Username");
    if (typeof groupDescriptionInput !== "string") errors.push("Invalid Group Description");
    if (typeof budgetInput !== "number") errors.push("Invalid Budget");
    if (typeof genderPreferenceInput !== "string") errors.push("Invalid Gender Preference")
    if (newPassword && typeof groupPasswordInput !== "string") {
      newPassword = false;
      errors.push("Invalid Group Password");
    }
    if (newPassword && (groupConfirmPasswordInput !== groupPasswordInput)) { 
      newPassword = false;
      errors.push("Passwords do not Match");
    }
    // don't push an error; user did not type in password so it stays the same
    if (newPassword && groupPasswordInput.length === 0) newPassword = false;


    groupNameInput = groupNameInput.trim();
    groupDescriptionInput = groupDescriptionInput.trim();
    groupUsernameInput = groupUsernameInput.trim();
    groupPasswordInput = groupPasswordInput.trim();
    groupConfirmPasswordInput = groupConfirmPasswordInput.trim();
    if (groupNameInput.length === 0) errors.push('The groupName field is empty.');
    if (groupDescriptionInput.length === 0) errors.push('The groupDescription field is empty.');
    if (groupUsernameInput.length === 0) errors.push('The groupUsername field is empty.');
    // if (groupPasswordInput.length === 0) errors.push('The groupPassword field is empty.');
    // if (groupConfirmPasswordInput.length === 0) errors.push('The groupConfirmPasswordInput field is empty.');
    let usernameSpaces = groupUsernameInput.split(" ");
    if (usernameSpaces.length > 1) errors.push(`${groupUsernameInput} contains spaces, invalid!`);
    if (newPassword && (groupPasswordInput.length < 8 || groupPasswordInput.length > 50)) {
      newPassword = false;
      errors.push(`groupPasswordInput must be > 8 characters and < 50 characters long.`);
    } 
    if (groupDescriptionInput.length > 1000) errors.push('The description has exceeded the 1000 character limit.');
    if (budgetInput <= 0 || budgetInput > 50000) errors.push('The budget must be nonnegative and below 50k.');
    genderPreferenceInput = genderPreferenceInput.toUpperCase();
    if ( (genderPreferenceInput !== 'M') && (genderPreferenceInput !== 'F') && (genderPreferenceInput !== 'O') ) errors.push('The genderPreference must be either M, F, or O');

    if (errors.length > 0) {
      return res.status(400).render("adminSettings", { title: "Admin Settings", error: errors, groupInfo: groupInfo });
    }

    let hashedPass = groupInfo.groupPassword;
    if (newPassword) {
      saltRounds = await bcrypt.genSalt(8);
      hashedPass = await bcrypt.hash(groupPasswordInput, saltRounds);
    }
    
    try {

      const updatedGroup = await groupsData.update(
        groupId, 
        groupNameInput,
        groupUsernameInput,
        groupDescriptionInput,
        groupInfo.groupLocation.coordinates,
        budgetInput,
        genderPreferenceInput,
        groupInfo.users,
        hashedPass,
        groupInfo.matches,
        groupInfo.suggestedMatches,
        groupInfo.reviews,
      );
      
      if (updatedGroup) {
        return res.redirect("/");
      } else {
        return res.status(500).render("adminSettings", { title: "Admin Settings", error: "Internal Server Error", groupInfo: groupInfo });
      }
    }
    catch (e) {
      return res.status(500).render("adminSettings", { title: "Admin Settings", error: e.toString(), groupInfo: groupInfo });
    }
  }
  );



export default router;
