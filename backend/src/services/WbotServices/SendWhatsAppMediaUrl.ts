import { WAMessage, AnyMessageContent } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import fs from "fs";
import { exec } from "child_process";
import path from "path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";
import mime from "mime-types";

interface Request {
  bodymediaurl: string;
  ticket: Ticket;
  body?: string;
}

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const processAudio = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.mp3`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath.path} -i ${audio} -vn -ab 128k -ar 44100 -f ipod ${outputAudio} -y`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};

const processAudioFile = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.mp3`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath.path} -i ${audio} -vn -ar 44100 -ac 2 -b:a 192k ${outputAudio}`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};

export const getMessageOptionsUrl = async (
  fileName: string,
  pathMedia: string
): Promise<any> => {
  const mimeType = mime.lookup(pathMedia);
  const typeMessage = mimeType.split("/")[0];

  try {
    if (!mimeType) {
      throw new Error("Invalid mimetype");
    }
    let options: AnyMessageContent;

    if (typeMessage === "video") {
      options = {
        video: fs.readFileSync(pathMedia),
        // caption: fileName,
        fileName: fileName
        // gifPlayback: true
      };
    } else if (typeMessage === "audio") {
      const typeAudio = fileName.includes("audio-record-site");
      const convert = await processAudio(pathMedia);
      if (typeAudio) {
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeAudio ? "audio/mp4" : mimeType,
          ptt: true
        };
      } else {
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeAudio ? "audio/mp4" : mimeType,
          ptt: true
        };
      }
    } else if (typeMessage === "document") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: fileName,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "application") {
      options = {
        document: fs.readFileSync(pathMedia),
        caption: fileName,
        fileName: fileName,
        mimetype: mimeType
      };
    } else {
      options = {
        image: fs.readFileSync(pathMedia),
        caption: fileName
      };
    }

    return options;
  } catch (e) {
    Sentry.captureException(e);
    console.log(e);
    return null;
  }
};

const SendWhatsAppMediaUrl = async ({
  bodymediaurl,
  ticket,
  body
}: Request): Promise<WAMessage> => {
  try {
    const wbot = await GetTicketWbot(ticket);

    const pathMedia = bodymediaurl;
    const mimeTypeUrl = mime.lookup(pathMedia);
    const typeMessage = mimeTypeUrl.split("/")[0];

    let options: AnyMessageContent;

    if (typeMessage === "video") {
      options = {
        video: { url: pathMedia },
        caption: body,
        fileName: pathMedia
        // gifPlayback: true
      };
    } else if (typeMessage === "audio") {
      //const typeAudio = media.originalname.includes("audio-record-site");
      const typeAudio = false;
      if (typeAudio) {
        const convert = await processAudio(pathMedia);
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeAudio ? "audio/mp4" : mimeTypeUrl,
          ptt: true
        };
      } else {
        const convert = await processAudioFile(pathMedia);
        options = {
          audio: fs.readFileSync(convert),
          mimetype: typeAudio ? "audio/mp4" : mimeTypeUrl
        };
      }
    } else if (typeMessage === "document" || typeMessage === "text") {
      options = {
        document: { url: pathMedia },
        caption: body,
        fileName: pathMedia,
        mimetype: mimeTypeUrl
      };
     } else if (typeMessage === "application") {
      options = {
        document: { url: pathMedia },
        caption: body,
        fileName: pathMedia,
        mimetype: mimeTypeUrl
      };
    } else {
      options = {
        image: { url: pathMedia },
        caption: body
      };
    }

    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        ...options
      }
    );

    await ticket.update({ lastMessage: pathMedia });

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMediaUrl;