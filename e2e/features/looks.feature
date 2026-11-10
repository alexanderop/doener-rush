Feature: Picking a chef look

  Scenario: The picked look goes into the shift and is remembered
    Given the home page
    When I flip my cook to the next look
    Then my cook is "Mimi"
    When I start the shift
    Then the shift dresses player 1 as "mimi"
    When I go back to the home page
    Then my cook is "Mimi"
