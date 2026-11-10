using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public static class Regions
{
    public static readonly IReadOnlyDictionary<string, string> Names = new Dictionary<
        string,
        string
    >
    {
        ["01"] = "dolnośląskie",
        ["02"] = "kujawsko-pomorskie",
        ["03"] = "lubelskie",
        ["04"] = "lubuskie",
        ["05"] = "łódzkie",
        ["06"] = "małopolskie",
        ["07"] = "mazowieckie",
        ["08"] = "opolskie",
        ["09"] = "podkarpackie",
        ["10"] = "podlaskie",
        ["11"] = "pomorskie",
        ["12"] = "śląskie",
        ["13"] = "świętokrzyskie",
        ["14"] = "warmińsko-mazurskie",
        ["15"] = "wielkopolskie",
        ["16"] = "zachodniopomorskie",
    };
}
