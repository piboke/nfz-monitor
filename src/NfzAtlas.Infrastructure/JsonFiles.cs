using System.IO.Compression;
using System.Text.Json;

namespace NfzAtlas.Infrastructure;

public static class JsonFiles
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
    };

    public static async Task<T?> Read<T>(string path, CancellationToken ct = default)
    {
        if (!File.Exists(path))
            return default;
        await using var file = File.OpenRead(path);
        if (path.EndsWith(".gz", StringComparison.Ordinal))
        {
            await using var zip = new GZipStream(file, CompressionMode.Decompress);
            return await JsonSerializer.DeserializeAsync<T>(zip, Options, ct);
        }
        return await JsonSerializer.DeserializeAsync<T>(file, Options, ct);
    }

    public static async Task Write<T>(string path, T value, CancellationToken ct = default)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await using (var file = File.Create(temp))
            {
                if (path.EndsWith(".gz", StringComparison.Ordinal))
                {
                    await using var zip = new GZipStream(
                        file,
                        CompressionLevel.SmallestSize,
                        leaveOpen: true
                    );
                    await JsonSerializer.SerializeAsync(zip, value, Options, ct);
                }
                else
                    await JsonSerializer.SerializeAsync(file, value, Options, ct);
            }
            File.Move(temp, path, true);
        }
        finally
        {
            if (File.Exists(temp))
                File.Delete(temp);
        }
    }
}
