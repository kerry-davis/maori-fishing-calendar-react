1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. Review `firebaseDataService.clearFirestoreUserData` for storage cleanup gaps
3. Inventory `/users/{uid}/catches` and `/users/{uid}/images` objects prior to Firestore deletion
4. Remove corresponding Firebase Storage objects alongside Firestore data
5. Verify deletion flow via targeted regression tests
6. Update docs/tests references as needed
7. Create file `.tasks/del_all_data_test1.files.md` listing modified files in short form
