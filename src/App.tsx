import { invoke } from "@tauri-apps/api/core";
import { Button, Card, Input } from "pixel-retroui";
import type { ChangeEventHandler, SubmitEventHandler } from "react";
import { useCallback, useState } from "react";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  const onSubmit: SubmitEventHandler<HTMLFormElement> = useCallback(
    (e) => {
      e.preventDefault();
      invoke("greet", { name }).then((value) => setGreetMsg(value as string));
      e.currentTarget.reset();
    },
    [name]
  );

  const onTextChange: ChangeEventHandler<HTMLInputElement, HTMLInputElement> =
    useCallback((e) => setName(e.currentTarget.value), []);

  return (
    <main className="flex h-dvh w-full items-center justify-center p-6">
      <div>
        <h1 className="mb-4 font-minecraft text-2xl">{greetMsg}</h1>
        <Card className="mb-4 gap-4 p-4">
          <form
            className="flex flex-row items-center justify-between gap-x-4"
            onSubmit={onSubmit}
          >
            <Input
              className="flex flex-1"
              onChange={onTextChange}
              placeholder="Enter a name..."
            />
            <Button type="submit">Greet</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

export default App;
