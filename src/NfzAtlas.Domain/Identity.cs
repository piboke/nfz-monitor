using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public static class Identity
{
    public static string ProviderFileKey(string code)
    {
        var bytes = Encoding.UTF8.GetBytes(code);
        if (bytes.Length is 0 or > 100)
            throw new ArgumentException("Nieprawidłowa długość kodu świadczeniodawcy.");
        return code.Length <= 20 && code.All(c => c is >= '0' and <= '9')
            ? code
            : "p-" + Convert.ToHexStringLower(bytes);
    }

    public static string Hash(string text) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)))[..24];

    public static string Normalize(string? text) =>
        string.Join(
                ' ',
                (text ?? "")
                    .Normalize(NormalizationForm.FormC)
                    .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            )
            .ToUpperInvariant();
}
