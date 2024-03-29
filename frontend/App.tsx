import "./styles.css";
import { useEffect, useState } from "react";
import { Button, Link, Image, Divider, CircularProgress } from "@nextui-org/react";
import { RecentlyPlayedResponse } from "./types";

function App() {
  const [token, setToken] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  const [descriptors, setDescriptors] = useState<string[]>([]);

  // const model = "https://api-inference.huggingface.co/models/google/gemma-7b-it";
  const model = "https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1";

  useEffect(() => {
    const hash = window.location.hash;
    let token = window.localStorage.getItem("token");

    if (!token && hash) {
      token = (
        hash
          .substring(1)
          .split("&")
          .find((elem) => elem.startsWith("access_token")) || ""
      ).split("=")[1];

      window.location.hash = "";
      window.localStorage.setItem("token", token);
    }

    setToken(token || ""); // Provide a default value of an empty string if token is null
  }, []);

  const logout = () => {
    setToken("");
    window.localStorage.removeItem("token");
    window.location.href = "/";
  };

  const getRecents = async () => {
    const token = window.localStorage.getItem("token");
    if (!token) {
      console.log("No Spotify token found in getRecents()");
      return;
    }

    try {
      const response = await fetch("/api/recently-played", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch recently played: ${response.statusText}`);
      }
      const responseJson: RecentlyPlayedResponse = await response.json();

      const entries = responseJson.items.map((item) => {
        const track = item.track;
        const artistNames = track.artists.map((artist) => artist.name).join(", ");
        return `${track.name} by ${artistNames}`;
      });

      return entries;
    } catch (e) {
      console.error("Error in getRecents:", e);
      return null;
    }
  };

  const getDescriptors = async (newRecents: string[]) => {
    try {
      const prompt = `Generate 6 adjectives that describe the color, physical texture, taste, smell, vibe, and style of the sum of the following songs: "${newRecents.join(
        '", "'
      )}." You don't have to listen to the songs, just infer. Return only the six adjectives in the following format, including the braces and the quotes: ["color", "physical texture", "taste", "smell", "vibe", "style"]. Replace each of those six elements with the corresponding descriptor you assigned.`;

      const response = await fetch(model, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: prompt, options: { use_cache: false } }),
      });
      const result = await response.json();

      const regex = /\["[^"]*",\s*"[^"]*",\s*"[^"]*",\s*"[^"]*",\s*"[^"]*",\s*"[^"]*"\]/g;
      const resultString = result[0].generated_text;
      console.log("Result string:", resultString);
      const jsonString = resultString.match(regex)[1];

      const adjectivesArray = JSON.parse(jsonString);
      return adjectivesArray;
    } catch (e) {
      console.error("Error in getDescriptors:", e);
      return null;
    }
  };

  const getImageUrl = async (descriptors: string[]) => {
    try {
      const prompt =
        "Generate an image of an abstract scene that embodies the following adjectives: " +
        descriptors.join(", ") +
        ".";

      const response = await fetch(
        "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5",
        {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_HF_TOKEN}` },
          method: "POST",
          body: JSON.stringify({ inputs: prompt }),
        }
      );
      const blob = await response.blob();

      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("Error in getImageUrl:", e);
      return null;
    }
  };

  const refresh = async () => {
    if (!token) {
      console.log("No token available for refreshing data.");
      return;
    }

    setRecents([]);
    setDescriptors([]);
    setImageUrl("");

    const newRecents = (await getRecents()) || [];
    setRecents(newRecents);

    const newDescriptors = (await getDescriptors(newRecents)) || [];
    setDescriptors(newDescriptors);

    const imageUrl = await getImageUrl(newDescriptors);
    setImageUrl(imageUrl || ""); // Provide a default value of an empty string
  };

  useEffect(() => {
    if (token) {
      refresh();
    }
  }, [token]);

  return (
    <>
      {!token ? (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "90vh",
              gap: "2rem", // Add vertical space between elements
            }}
          >
            <h1 style={{ textAlign: "center", fontSize: "3rem", marginBottom: "3rem" }}>
              Spotify Visuals Generator!
            </h1>
            <div className="flex h-5 items-center space-x-4 text-small w-2/3">
              <h2
                style={{
                  textAlign: "center",
                  fontSize: "2rem",
                  marginBottom: "2rem",
                  marginTop: "1rem",
                  lineHeight: "2rem",
                }}
              >
                <i>Generate cool visualizations based on your recent listening history</i>
              </h2>
              <Divider orientation="vertical" style={{ height: "8vh" }} />
              <h2
                style={{
                  textAlign: "center",
                  fontSize: "2rem",
                  marginBottom: "2rem",
                  marginTop: "1rem",
                  lineHeight: "2rem",
                }}
              >
                <i>Log in with your Spotify account and let me handle the rest!</i>
              </h2>
            </div>
            <p
              style={{
                textAlign: "justify",
                fontSize: "1rem",
                marginBottom: "1rem",
                marginTop: "3rem",
                width: "70%",
              }}
            >
              Abstract images are created from your recently played songs on a rolling basis. Variations are
              generated on each image, then frame interpolation is used to create a smooth transition between
              each variation. This visualization is looped for a period of time, then your recently played
              music is reassessed and we seamlessly transition to the next visualization. The result is a
              neverending, captivating visual experience that reflects the energy and essence of your music
              choices, acting as a stunning computer screensaver, background visuals casted to your TV, or the
              backdrop for any scenario you can think of that could use a vibe boost!
            </p>
            <Button href={"/api/auth-login"} as={Link} color="primary" showAnchorIcon variant="solid">
              Log in with Spotify
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col h-full">
            <header className="flex justify-between items-center p-4">
              <Button
                onClick={logout}
                color="warning"
                variant="solid"
                className="py-2 px-4 font-bold rounded"
              >
                Log out
              </Button>
              <Button
                onClick={refresh}
                color="primary"
                variant="solid"
                className="py-2 px-4 font-bold rounded"
              >
                Refresh
              </Button>
            </header>

            <main className="flex-grow">
              <div className="flex divide-x divide-gray-300 h-full">
                <div className="w-1/3 flex flex-col">
                  <h2 className="text-lg font-semibold text-center mt-4">Recently played songs</h2>
                  <div className="flex-grow flex items-center justify-center">
                    <ol className="text-left">
                      {recents[0] ? (
                        recents.map((item: string, index: number) => (
                          <li className="p-1" key={index}>{`${index + 1}. ${item}`}</li>
                        ))
                      ) : (
                        <CircularProgress aria-label="Loading..." />
                      )}
                    </ol>
                  </div>
                </div>

                <div className="w-1/3 flex flex-col">
                  <h2 className="text-lg font-semibold text-center mt-4">Generated descriptors</h2>
                  <div className="flex-grow flex items-center justify-center">
                    <ol className="text-left">
                      {descriptors[0] ? (
                        descriptors.map((item: string, index: number) => (
                          <li className="p-1" key={index}>{`${index + 1}. ${item}`}</li>
                        ))
                      ) : (
                        <CircularProgress aria-label="Loading..." />
                      )}
                    </ol>
                  </div>
                </div>

                <div className="w-1/3 flex flex-col">
                  <h2 className="text-lg font-semibold text-center mt-4">Generated image</h2>
                  <div className="flex-grow flex items-center justify-center">
                    <ol className="text-left">
                      {imageUrl ? (
                        <Image src={imageUrl} alt="Generated" className="max-w-full h-auto" />
                      ) : (
                        <CircularProgress aria-label="Loading..." />
                      )}
                    </ol>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </>
      )}
      <footer
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, textAlign: "center", fontSize: "1.5rem" }}
      >
        made by aiden tepper
      </footer>
    </>
  );
}

export default App;
