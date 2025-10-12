1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. Reassess `clearFirestoreUserData` for missing storage safeguards when Firebase config is incomplete
3. Add guard clauses to skip storage inventory if `storage` is unavailable
4. Evaluate batching strategy for `deleteObject` and consider parallel execution
5. Update automated tests to cover storage-guard and deletion-batching scenarios
6. Create file `.tasks/del_all_data_test2.files.md` listing modified files in short form
