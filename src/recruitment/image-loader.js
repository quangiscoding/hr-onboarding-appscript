function getDriveFileBase64(urlOrId) {
  try {
    if (!urlOrId) return null;
    var match = urlOrId.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
    var fileId = match ? match[1] : urlOrId;
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    return Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    return null;
  }
}
