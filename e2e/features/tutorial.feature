Feature: The tutorial teaches the kitchen step by step

  Scenario: The home page leads to the tutorial
    Given the home page
    When the player opens the tutorial
    Then the tutorial shows step 1 "Laufen"

  Scenario: Walking finishes the first lesson
    Given the tutorial
    When player 1 holds "d" for 900 ms
    Then the tutorial shows step 2 "Sprinten"
