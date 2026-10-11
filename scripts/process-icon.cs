using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

namespace IconProcessor
{
    class Program
    {
        static void Main(string[] args)
        {
            string sourcePath = args.Length > 0 ? args[0] : @"C:\Users\lukab\.gemini\antigravity\brain\d1995a13-d5aa-4077-91f8-2daa1f25d8fa\flat_laptop_sparkles_1791690379136.jpg";
            string outputPng = args.Length > 1 ? args[1] : @"assets\icon\app-icon.png";
            string outputIco = args.Length > 2 ? args[2] : @"assets\icon\app.ico";

            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPng)));
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputIco)));

            Console.WriteLine("Loading image: " + sourcePath);
            using (Bitmap srcBmp = new Bitmap(sourcePath))
            {
                int w = srcBmp.Width;
                int h = srcBmp.Height;

                Bitmap transparentBmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
                Rectangle rect = new Rectangle(0, 0, w, h);

                BitmapData srcData = srcBmp.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                BitmapData outData = transparentBmp.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);

                int stride = Math.Abs(srcData.Stride);
                int totalBytes = stride * h;
                byte[] srcBytes = new byte[totalBytes];
                byte[] outBytes = new byte[totalBytes];

                Marshal.Copy(srcData.Scan0, srcBytes, 0, totalBytes);
                srcBmp.UnlockBits(srcData);

                // BFS flood-fill from border pixels that are near-white (R,G,B >= 238)
                bool[,] visited = new bool[w, h];
                bool[,] isBackground = new bool[w, h];
                Queue<Point> queue = new Queue<Point>();

                for (int x = 0; x < w; x++)
                {
                    queue.Enqueue(new Point(x, 0));
                    visited[x, 0] = true;
                    queue.Enqueue(new Point(x, h - 1));
                    visited[x, h - 1] = true;
                }
                for (int y = 0; y < h; y++)
                {
                    if (!visited[0, y]) { queue.Enqueue(new Point(0, y)); visited[0, y] = true; }
                    if (!visited[w - 1, y]) { queue.Enqueue(new Point(w - 1, y)); visited[w - 1, y] = true; }
                }

                while (queue.Count > 0)
                {
                    Point pt = queue.Dequeue();
                    int idx = (pt.Y * stride) + (pt.X * 4);
                    byte b = srcBytes[idx];
                    byte g = srcBytes[idx + 1];
                    byte r = srcBytes[idx + 2];

                    // Check if near white
                    if (r >= 238 && g >= 238 && b >= 238)
                    {
                        isBackground[pt.X, pt.Y] = true;

                        Point[] neighbors = new Point[]
                        {
                            new Point(pt.X + 1, pt.Y),
                            new Point(pt.X - 1, pt.Y),
                            new Point(pt.X, pt.Y + 1),
                            new Point(pt.X, pt.Y - 1)
                        };

                        foreach (Point n in neighbors)
                        {
                            if (n.X >= 0 && n.X < w && n.Y >= 0 && n.Y < h && !visited[n.X, n.Y])
                            {
                                visited[n.X, n.Y] = true;
                                queue.Enqueue(n);
                            }
                        }
                    }
                }

                // Copy pixels with alpha anti-aliasing on borders
                for (int y = 0; y < h; y++)
                {
                    for (int x = 0; x < w; x++)
                    {
                        int idx = (y * stride) + (x * 4);
                        byte b = srcBytes[idx];
                        byte g = srcBytes[idx + 1];
                        byte r = srcBytes[idx + 2];

                        if (isBackground[x, y])
                        {
                            outBytes[idx] = 0;
                            outBytes[idx + 1] = 0;
                            outBytes[idx + 2] = 0;
                            outBytes[idx + 3] = 0;
                        }
                        else
                        {
                            // Check if near any background pixel to apply soft edge
                            bool nearBg = false;
                            for (int dy = -1; dy <= 1; dy++)
                            {
                                for (int dx = -1; dx <= 1; dx++)
                                {
                                    int nx = x + dx;
                                    int ny = y + dy;
                                    if (nx >= 0 && nx < w && ny >= 0 && ny < h && isBackground[nx, ny])
                                    {
                                        nearBg = true;
                                        break;
                                    }
                                }
                                if (nearBg) break;
                            }

                            if (nearBg && r >= 220 && g >= 220 && b >= 220)
                            {
                                // Soft alpha fade based on brightness
                                double brightness = (r + g + b) / (3.0 * 255.0);
                                int alpha = (int)((1.0 - Math.Max(0, (brightness - 0.85) / 0.15)) * 255);
                                if (alpha < 0) alpha = 0;
                                if (alpha > 255) alpha = 255;

                                outBytes[idx] = b;
                                outBytes[idx + 1] = g;
                                outBytes[idx + 2] = r;
                                outBytes[idx + 3] = (byte)alpha;
                            }
                            else
                            {
                                outBytes[idx] = b;
                                outBytes[idx + 1] = g;
                                outBytes[idx + 2] = r;
                                outBytes[idx + 3] = 255;
                            }
                        }
                    }
                }

                Marshal.Copy(outBytes, 0, outData.Scan0, totalBytes);
                transparentBmp.UnlockBits(outData);

                // Save PNG
                Console.WriteLine("Saving PNG: " + outputPng);
                transparentBmp.Save(outputPng, ImageFormat.Png);

                // Generate multi-resolution ICO (256, 128, 64, 48, 32, 16)
                Console.WriteLine("Generating ICO: " + outputIco);
                int[] sizes = new int[] { 256, 128, 64, 48, 32, 16 };
                List<KeyValuePair<int, byte[]>> icoEntries = new List<KeyValuePair<int, byte[]>>();

                foreach (int s in sizes)
                {
                    using (Bitmap resized = new Bitmap(s, s, PixelFormat.Format32bppArgb))
                    {
                        using (Graphics g = Graphics.FromImage(resized))
                        {
                            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                            g.SmoothingMode = SmoothingMode.HighQuality;
                            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                            g.DrawImage(transparentBmp, 0, 0, s, s);
                        }
                        using (MemoryStream ms = new MemoryStream())
                        {
                            resized.Save(ms, ImageFormat.Png);
                            icoEntries.Add(new KeyValuePair<int, byte[]>(s, ms.ToArray()));
                        }
                    }
                }

                using (FileStream fs = File.Create(outputIco))
                using (BinaryWriter bw = new BinaryWriter(fs))
                {
                    bw.Write((ushort)0); // Reserved
                    bw.Write((ushort)1); // Type 1 = ICO
                    bw.Write((ushort)icoEntries.Count);

                    int offset = 6 + (icoEntries.Count * 16);
                    foreach (var entry in icoEntries)
                    {
                        int s = entry.Key;
                        byte[] bytes = entry.Value;
                        byte dim = (byte)(s >= 256 ? 0 : s);

                        bw.Write(dim); // Width
                        bw.Write(dim); // Height
                        bw.Write((byte)0); // Colors
                        bw.Write((byte)0); // Reserved
                        bw.Write((ushort)1); // Planes
                        bw.Write((ushort)32); // BPP
                        bw.Write((uint)bytes.Length); // Size
                        bw.Write((uint)offset); // Offset
                        offset += bytes.Length;
                    }

                    foreach (var entry in icoEntries)
                    {
                        bw.Write(entry.Value);
                    }
                    bw.Flush();
                }

                transparentBmp.Dispose();
                Console.WriteLine("Icon generation completed successfully!");
            }
        }
    }
}
