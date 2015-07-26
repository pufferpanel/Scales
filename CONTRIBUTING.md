# Contributing to Scales

We welcome any contributions to Scales, whether in the form of bug reports, feature suggestions, and even code submissions. When submitting any of those, please follow this documentation to help speed up the process.

# Reporting Bugs

A bug is when the software does not behave in a way that is expected. It is **not** invalid configurations which render the software broken.

If you believe you have located a bug, please report it to the [Bug Tracker](https://github.com/PufferPanel/Scales/issues).

**Please make sure there is not an issue for your specific bug already!** If you find that someone else has reported a bug you have, please comment on that issue stating you have replicated that bug. Do not make a new issue.

When submitting those bugs, follow these standards:
* The title of the issue should **clearly** and **quickly** explain the issue. A good title would be "Cannot delete IPs from node if it has 2 or more ports".
* The description should contain the following information
  * A complete description of the problem. This should explain what you expect the panel to do and what the panel actually did.
  * Steps to reproduce the bug. It is hard to figure out what the bug truly is if we cannot do it ourselves.

# Submitting feature requests

If you have an idea for a new feature or enhancement, please suggest it on our [Community Forum](https://community.pufferpanel.com/forum/5-feature-requests/)

# How to Contribute

When submitting new code to the panel, you **must** follow both the standards outlined later in this documentation, along with the following:
* All PRs must contain a reference to an **existing** issue. If there is no issue for your PR to reference, then create a new issue, following the guidelines above.
* PRs may only contain **1** feature or enhancement. Kitchen sinks will be throw out the window.

# Standards

The following standards should be followed when contributing to Scales.

## Files
* There **should** be a newline at the end of a file.

## Lines
* There **must not** be a hard limit on line length.
* There **must not** be trailing whitespace at the end of non-blank lines.
* Blank lines **should** be added to improve readability and to indicate related blocks of code. These lines **should not** be indented.

## Indenting & Spacing
* Curly brackets should **always** be on the same line as the statement they are being used for.
* All functions should have a space after the closing parenthesis and before the curly brackets ``{ }``. Additionally, any function using curly brackets should have a space between the function and the bracket.
* For single line ``if/else`` statements, curly brackets **are required**. This change was implemented after a lot of previous code was written, so do not simply copy what is already there.
