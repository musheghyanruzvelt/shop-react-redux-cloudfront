import React from "react";
import axios from "axios";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

type CSVFileImportProps = {
  url: string;
  title: string;
};

export default function CSVFileImport({ url, title }: CSVFileImportProps) {
  const [file, setFile] = React.useState<File | undefined>();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  };

  const removeFile = () => {
    setFile(undefined);
  };

  const uploadFile = async () => {
    if (!file) return;

    try {
      console.log("uploadFile to", url);

      // 1. Get the presigned URL from your Lambda
      const response = await axios({
        method: "GET",
        url,
        params: {
          name: encodeURIComponent(file.name),
        },
      });

      console.log("File to upload: ", file.name);
      console.log("Uploading to: ", response.data);

      // 2. Upload the file directly to S3 using the signed URL
      const result = await fetch(response.data, {
        method: "PUT",
        body: file,
      });

      console.log("Result: ", result);

      if (result.ok) {
        alert(`File "${file.name}" uploaded successfully!`);
      } else {
        alert(`Upload failed with status: ${result.status}`);
      }

      setFile(undefined);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file. Check console for details.");
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {!file ? (
        <input type="file" accept=".csv" onChange={onFileChange} />
      ) : (
        <div>
          <p>Selected: {file.name}</p>
          <button onClick={removeFile}>Remove file</button>
          <button onClick={uploadFile}>Upload file</button>
        </div>
      )}
    </Box>
  );
}
