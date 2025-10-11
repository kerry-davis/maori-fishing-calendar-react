1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. Audit `ensurePhotoInStorage` fallback to ensure photos aren’t discarded when Storage is unavailable
3. Retain inline photo data or skip removal when uploads are skipped
4. Update creation/import flows to handle preserved inline photos safely
5. Extend automated tests to cover the storage-unavailable photo path scenario
6. Create file `.tasks/del_all_data_test3.files.md` listing modified files in short form
