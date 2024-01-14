import assert from "assert";
import { When, Then, Given, setDefaultTimeout } from "@cucumber/cucumber";
import axios from "axios";
import { MailSlurp } from "mailslurp-client";

setDefaultTimeout(5_000);

const mailslurp = new MailSlurp({ apiKey: process.env.MAILSLURP_CLIENT });
const base_url = "http://localhost:3000";

let successful_login = false;
let response = null;
let token = "";
let email = {};

When(
  "the user with email {string} and password {string} wants to log in",
  async function(email, password) {
    if (email === "$ACTUAL_EMAIL") {
      email = process.env.MAILSLURP_EMAIL_URL;
    }
    response = await axios.post(
      `${base_url}/login`,
      {
        email,
        password,
      },
      { maxRedirects: 0, validateStatus: null },
    );
  },
);

Then("the user should be redirected to {string}", function(path) {
  path = path.replaceAll("$ACTUAL_EMAIL", process.env.MAILSLURP_EMAIL_URL);
  assert.ok(
    response.status >= 300 && response.status < 400,
    `Expected a redirect status code. got ${response.status}, ${JSON.stringify(
      response.data,
    )}`,
  );
  assert.strictEqual(response.headers.location, path);
  successful_login = true;
  if (response.headers.location.includes("/two-factor")) {
    successful_login = true;
  }
});

When("the user has entered right credentials", function() {
  successful_login = true;
  assert.ok(successful_login);
});

Then(
  "an email should be send to his email",
  { timeout: 10_000 },
  async function() {
    email = null;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    try {
      email = await mailslurp.getAllEmails(
        0,
        10,
        process.env.MAILSLURP_INBOX_ID,
        "DESC",
      );
      email = email.content[0].bodyExcerpt.trim();
      console.log("email", email);
    } catch (err) {
      console.log("error", err);
    }
    assert.notEqual(email, null);
  },
);

Then("the email should contain 2fa code", function() {
  assert.notEqual(email, null);
  assert.ok(email.includes("Token:"));
  token = email.split(" ")[1];
  token = parseInt(token);
  assert.notEqual(token, NaN);
});

When("the user obtained 2fa token", function() {
  assert.notEqual(token, "");
});

Then("the user should enter wrong token", async function() {
  response = await axios.post(
    `${base_url}/two-factor?email=${process.env.MAILSLURP_EMAIL_URL}`,
    {
      two_factor: (token + 999).toString(),
    },
    { maxRedirects: 0, validateStatus: null },
  );
});

Then("the user should enter the right token", async function() {
  response = await axios.post(
    `${base_url}/two-factor?email=${process.env.MAILSLURP_EMAIL_URL}`,
    {
      two_factor: token.toString(),
    },
    { maxRedirects: 0, validateStatus: null },
  );
});
