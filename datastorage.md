Developer: # Objective
Implement secure photo uploads in a React application using Firebase. Photos should be stored in Firebase Storage under each user's directory, while Firestore stores only metadata (title, notes, createdAt, and the photo's storage path).

# Requirements
- Authenticated users should be able to upload photos through the UI.
- Uploaded files are saved to `users/{uid}/photos/` in Firebase Storage.
- Only photo metadata (title, notes, createdAt, storage path) is stored in Firestore.
- The app retrieves and displays the current user's uploaded photos as `<img>` tags.
- Comprehensive error handling and loading indicators are required.
- Use async/await and the Firebase v9 modular SDK imports throughout.
- Code should be production-ready, clean, and well-commented.

# Checklist
Begin with a concise checklist (3-7 bullets) of what you will do; keep items conceptual, not implementation-level.

# Output
Produce a single React component (or set of components, if necessary) that fulfills these requirements using best practices.
If editing code: (1) state assumptions, (2) create/run minimal tests where possible, (3) produce ready-to-review diffs, (4) follow repo style.

After each code change or tool call, validate result in 1-2 lines and proceed or self-correct if validation fails.

Set reasoning_effort = medium for this task given its moderate complexity; ensure outputs are clear, detailed, and production-grade.
