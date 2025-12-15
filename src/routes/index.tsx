import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { createAsync, query } from "@solidjs/router";
import { createSignal, For, Match, Show, Switch } from "solid-js";
import { drive_v3, google } from "googleapis";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { Component, createMemo } from "solid-js";
import FileText from "lucide-solid/icons/file-text";
import Music from "lucide-solid/icons/music";
import FileImage from "lucide-solid/icons/file-image";
import FileVideo from "lucide-solid/icons/file-video";
import Folder from "lucide-solid/icons/folder";
import FileSpreadsheet from "lucide-solid/icons/file-spreadsheet";
import Presentation from "lucide-solid/icons/presentation";
import FileCode from "lucide-solid/icons/file-code";
import File from "lucide-solid/icons/file";
import FileOutput from "lucide-solid/icons/file-output";
import Loader2 from "lucide-solid/icons/loader-2";

import { TextField, TextFieldRoot } from "@/components/ui/textfield";

const mimeTypeIcons = {
  "application/vnd.google-apps.audio": Music,
  "application/vnd.google-apps.document": FileText,
  "application/vnd.google-apps.drive-sdk": FileOutput,
  "application/vnd.google-apps.drawing": FileImage,
  "application/vnd.google-apps.file": File,
  "application/vnd.google-apps.folder": Folder,
  "application/vnd.google-apps.form": FileText,
  "application/vnd.google-apps.fusiontable": FileSpreadsheet,
  "application/vnd.google-apps.jam": FileImage,
  "application/vnd.google-apps.mail-layout": FileText,
  "application/vnd.google-apps.map": FileText,
  "application/vnd.google-apps.photo": FileImage,
  "application/vnd.google-apps.presentation": Presentation,
  "application/vnd.google-apps.script": FileCode,
  "application/vnd.google-apps.shortcut": FileOutput,
  "application/vnd.google-apps.site": FileText,
  "application/vnd.google-apps.spreadsheet": FileSpreadsheet,
  "application/vnd.google-apps.unknown": File,
  "application/vnd.google-apps.vid": FileVideo,
  "application/vnd.google-apps.video": FileVideo,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    FileSpreadsheet,
  "video/mp4": FileVideo,
  "application/pdf": FileText,
  "application/vnd.google.colaboratory": FileText,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    FileText,
  "image/jpeg": FileImage,
  "text/plain": FileText,
  "application/vnd.oasis.opendocument.text": FileText,
  "application/msword": FileText,
  "application/x-iwork-pages-sffpages": FileText,
  "image/png": FileImage,
  "audio/mpeg": Music,
};

const MimeTypeIcon: Component<{ mimeType?: string | null; size?: number }> = (
  props,
) => {
  if (!mimeTypeIcons[props.mimeType]) {
    console.log(props.mimeType);
  }
  const Icon = createMemo(() => mimeTypeIcons[props.mimeType] || File);
  return <Icon size={props.size || 24} />;
};

const listFilesQuery = query(async (userId: string) => {
  "use server";

  const acc = await db.query.account.findFirst({
    where: eq(schema.account.userId, userId),
  });
  if (!acc) return [];

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: acc.accessToken,
  });

  const drive = google.drive({
    version: "v3",
    auth: oauth2Client,
  });

  let pageToken: string | undefined = undefined;
  const files = [];

  while (true) {
    const response = await drive.files.list({
      pageSize: 100,
      pageToken,
      fields: "nextPageToken, files(id, name, mimeType)", // Specify required fields
      // q: "'me' in owners",
    });

    if (response.data.files) {
      files.push(...response.data.files);
    }
    pageToken = response.data.nextPageToken;
    // pageToken = undefined;

    if (!pageToken) break; // Stop when there's no more data
  }
  return files;
}, "list-files");

export default function Home() {
  const session = authClient.useSession();
  const files = createAsync(async () => {
    const session = authClient.useSession();
    const userId = session().data?.user.id;

    if (!userId) {
      console.log("no user id");
      return;
    }
    console.log("user id", userId);
    return await listFilesQuery(userId);
    // return [];
  });

  return (
    <main class="h-full">
      <nav class="flex items-center justify-between bg-neutral-100 p-4">
        <h1>Google Drive Search</h1>
        <Show when={session()} fallback="loading user">
          {(session) => (
            <Switch>
              <Match when={!session().data}>
                <Button
                  onClick={() =>
                    authClient.signIn.social({ provider: "google" })
                  }
                >
                  Sign in
                </Button>
              </Match>
              <Match when={session().data}>
                <Button onClick={() => authClient.signOut()}>Sign out</Button>
              </Match>
            </Switch>
          )}
        </Show>
      </nav>
      <Show when={files()} fallback={<Loader2 class="animate-spin" />}>
        {(files) => <FileList files={files()} />}
      </Show>
    </main>
  );
}

/*

*/
function FileList(props: { files: drive_v3.Schema$File[] }) {
  let ref!: HTMLDivElement;

  const [text, setText] = createSignal("");
  const filteredItems = createMemo(() =>
    props.files.filter((file) => file.name?.includes(text())),
  );

  return (
    <div class="flex h-full flex-col gap-4 p-4">
      <TextFieldRoot
        class="w-full"
        onChange={(str) => setText(str)}
        value={text()}
      >
        <TextField placeholder="name" />
      </TextFieldRoot>
      <div ref={ref}>
        <ul class="flex flex-col">
          <For each={filteredItems()}>
            {(file) => (
              <li class="py-2 hover:bg-neutral-200">
                <a
                  target="_blank"
                  href={
                    file.mimeType === "application/vnd.google-apps.folder"
                      ? `https://drive.google.com/drive/folders/${file.id}`
                      : `https://drive.google.com/file/d/${file.id}/view`
                  }
                  class="flex items-center gap-2 "
                >
                  <MimeTypeIcon mimeType={file.mimeType} />
                  {file.name}
                </a>
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  );
}
