Feature: TwoFactorAuthentication

  Scenario: Login nonexistent user
    When the user with email "nonexistent@nonexistent.com" and password "none" wants to log in
    Then the user should be redirected to "/login-failed?reason=no-user"

  Scenario: Login user with wrong password
    When the user with email "$ACTUAL_EMAIL" and password "randompass" wants to log in
    Then the user should be redirected to "/login-failed?reason=wrong-password"

  Scenario: Login sucessful
    When the user with email "$ACTUAL_EMAIL" and password "true_password" wants to log in
    Then the user should be redirected to "/two-factor?email=$ACTUAL_EMAIL"

  Scenario: Two factor authentication received
    When the user has entered right credentials
    Then an email should be send to his email 
    And the email should contain 2fa code
  
  Scenario: Two factor authentication, wrong token entered
    When the user obtained 2fa token
    Then the user should enter wrong token
    And the user should be redirected to "/login-failed?reason=2fa-token-mismatch"

  Scenario: Two factor authentication, right token entered
    When the user obtained 2fa token
    Then the user should enter the right token
    And the user should be redirected to "/login-success"





