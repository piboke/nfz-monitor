using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public sealed record Partition(string Province, int Case, string? Benefit = null)
{
    public string Key => $"{Province}-{Case}-{Identity.Hash(Benefit ?? "*")}";
}
